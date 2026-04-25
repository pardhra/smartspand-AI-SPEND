from flask import Flask, render_template, request, jsonify
import sqlite3
import pandas as pd
from datetime import datetime
import numpy as np
from sklearn.linear_model import LinearRegression
import os

app = Flask(__name__)
DB_PATH = 'database.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    # Default budget
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('monthly_budget', '2000')")
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/add', methods=['POST'])
def add_expense():
    try:
        data = request.json
        name = data.get('name')
        amount = float(data.get('amount'))
        category = data.get('category')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))

        if not name or not amount or not category:
            return jsonify({"error": "Missing fields"}), 400

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('INSERT INTO expenses (name, amount, category, date) VALUES (?, ?, ?, ?)',
                       (name, amount, category, date))
        conn.commit()
        conn.close()
        return jsonify({"message": "Expense added successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/data')
def get_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT * FROM expenses", conn)
    
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key='monthly_budget'")
    budget = float(cursor.fetchone()[0])
    conn.close()

    expenses = df.to_dict(orient='records')
    total_expense = df['amount'].sum() if not df.empty else 0
    
    return jsonify({
        "expenses": expenses,
        "total_expense": total_expense,
        "budget": budget,
        "budget_left": budget - total_expense
    })

@app.route('/update_budget', methods=['POST'])
def update_budget():
    data = request.json
    budget = data.get('budget')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE settings SET value = ? WHERE key = 'monthly_budget'", (budget,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Budget updated"})

@app.route('/ai')
def ai_suggestions():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT * FROM expenses", conn)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key='monthly_budget'")
    budget = float(cursor.fetchone()[0])
    conn.close()

    if df.empty:
        return jsonify({"suggestions": ["Start adding expenses to get AI insights!"], "health_score": 10})

    total = df['amount'].sum()
    category_totals = df.groupby('category')['amount'].sum()
    
    suggestions = []
    
    # Rule-Based AI
    if total > budget:
        suggestions.append("⚠️ Fiscal Alert: Monthly expenditure has exceeded the defined capital threshold.")
    elif total > budget * 0.8:
        suggestions.append("📉 Notice: Portfolio utilization has reached 80% of the allocated budget.")

    for cat, amt in category_totals.items():
        percentage = (amt / total) * 100
        if cat == 'Food' and percentage > 40:
            suggestions.append("🍱 Pattern: Hospitality and dining costs represent a high percentage of net outflow.")
        if cat == 'Shopping' and percentage > 30:
            suggestions.append("🛍️ Insight: Discretionary shopping activity is impacting liquidity. Consider prioritizing essentials.")
        if cat == 'Investments' and percentage > 20:
            suggestions.append("📈 Positive: Significant allocation towards asset growth detected.")

    # Smart pattern detection (Weekend)
    df['date'] = pd.to_datetime(df['date'])
    df['day_name'] = df['date'].dt.day_name()
    weekend_spend = df[df['day_name'].isin(['Saturday', 'Sunday'])]['amount'].sum()
    weekday_spend = df[~df['day_name'].isin(['Saturday', 'Sunday'])]['amount'].sum()
    
    if weekend_spend > weekday_spend:
        suggestions.append("📅 Cyclic Analysis: Capital outflow peaks during the weekend cycle.")

    # Health Score Calculation
    # Factors: Budget adherence, categorical balance
    score = 10
    if total > budget: score -= 4
    elif total > budget * 0.8: score -= 2
    
    if (category_totals.get('Food', 0) / total) > 0.5: score -= 1
    if (category_totals.get('Shopping', 0) / total) > 0.4: score -= 1
    
    return jsonify({
        "suggestions": suggestions,
        "health_score": max(1, score)
    })

@app.route('/predict')
def predict_expense():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT amount, date FROM expenses", conn)
    conn.close()

    if df.empty:
        return jsonify({"prediction": 0, "status": "no_data"})

    df['date'] = pd.to_datetime(df['date'])
    
    # Fallback: If not enough days of data, use average daily spend * 30
    days_recorded = (df['date'].max() - df['date'].min()).days + 1
    total_spent = df['amount'].sum()
    avg_daily = total_spent / max(1, days_recorded)
    simple_forecast = avg_daily * 30

    if len(df) < 5:
        return jsonify({
            "prediction": round(float(simple_forecast), 2),
            "status": "success",
            "method": "average"
        })

    try:
        # ML Logic
        daily_spend = df.groupby(df['date'].dt.date)['amount'].sum().reset_index()
        daily_spend['day_index'] = np.arange(len(daily_spend))

        X = daily_spend[['day_index']]
        y = daily_spend['amount']

        model = LinearRegression()
        model.fit(X, y)

        next_days = np.array([[len(daily_spend) + i] for i in range(1, 31)])
        predictions = model.predict(next_days)
        predicted_monthly = sum(predictions)
        
        # Use ML if it seems reasonable, otherwise fallback to simple average
        final_prediction = predicted_monthly if predicted_monthly > 0 else simple_forecast

        return jsonify({
            "prediction": round(float(final_prediction), 2),
            "status": "success",
            "method": "ml"
        })
    except:
        return jsonify({
            "prediction": round(float(simple_forecast), 2),
            "status": "success",
            "method": "fallback"
        })

@app.route('/delete/<int:id>', methods=['DELETE'])
def delete_expense(id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM expenses WHERE id = ?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Expense deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)

let categoryChart;
let trendChartFull;
let velocityChart;

const fintechColors = [
    '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#06b6d4', 
    '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16',
    '#3b82f6', '#d946ef', '#0891b2', '#fbbf24'
];

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadAIInsights();
    loadPrediction();

    const form = document.getElementById('expenseForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('expName').value,
                amount: document.getElementById('expAmount').value,
                category: document.getElementById('expCategory').value
            };

            const response = await fetch('/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                form.reset();
                loadData();
                loadAIInsights();
                loadPrediction();
            }
        });
    }
    
    // Enter key for chat
    const chatInput = document.getElementById('userInput');
    if(chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') sendMessage();
        });
    }
});

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    const target = document.getElementById(sectionId + 'Section');
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navItem = document.getElementById('nav-' + sectionId);
    if (navItem) navItem.classList.add('active');
    loadData();
}

async function loadData() {
    try {
        const response = await fetch('/data');
        const data = await response.json();
        document.getElementById('totalExpense').innerText = data.total_expense.toLocaleString();
        document.getElementById('monthlyBudget').innerText = data.budget.toLocaleString();
        document.getElementById('budgetLeft').innerText = data.budget_left.toLocaleString();
        
        const budgetLeftEl = document.getElementById('budgetLeft');
        if (data.budget_left < 0) {
            budgetLeftEl.style.color = '#ef4444';
        } else {
            budgetLeftEl.style.color = '#10b981';
        }

        if (document.getElementById('savingsVal')) {
            document.getElementById('savingsVal').innerText = (data.budget - data.total_expense).toLocaleString();
        }

        updateExpenseTables(data.expenses);
        updateCharts(data.expenses);
    } catch (e) { console.error(e); }
}

function updateExpenseTables(expenses) {
    const tbodyShort = document.querySelector('#expenseTableShort tbody');
    if (tbodyShort) {
        tbodyShort.innerHTML = '';
        expenses.slice(-5).reverse().forEach(exp => {
            const row = `<tr>
                <td style="font-weight: 600;">${exp.name}</td>
                <td><span class="category-pill">${exp.category}</span></td>
                <td style="font-weight: 700;">₹${exp.amount}</td>
            </tr>`;
            tbodyShort.innerHTML += row;
        });
    }
    const tbodyFull = document.querySelector('#expenseTableFull tbody');
    if (tbodyFull) {
        tbodyFull.innerHTML = '';
        expenses.slice().reverse().forEach(exp => {
            const row = `<tr>
                <td style="color: var(--text-muted); font-size: 0.8rem;">${exp.date}</td>
                <td style="font-weight: 600;">${exp.name}</td>
                <td><span class="category-pill">${exp.category}</span></td>
                <td style="font-weight: 700;">₹${exp.amount}</td>
                <td><i class="fas fa-trash-alt" style="color: var(--danger); cursor: pointer; font-size: 0.8rem;" onclick="deleteExpense(${exp.id})"></i></td>
            </tr>`;
            tbodyFull.innerHTML += row;
        });
    }
}

function updateCharts(expenses) {
    const categories = [
        'Food', 'Travel', 'Shopping', 'Bills', 'Groceries', 
        'Entertainment', 'Health', 'Education', 'Investments', 
        'Rent', 'Insurance', 'Gifts', 'Subscriptions', 'Others'
    ];
    const totals = categories.map(cat => {
        return expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    });

    const ctxPie = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: totals,
                backgroundColor: fintechColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { color: '#64748b', usePointStyle: true, font: { size: 10 } } 
                } 
            }
        }
    });

    const ctxTrendFull = document.getElementById('trendChartFull');
    if (ctxTrendFull && document.getElementById('analyticsSection').classList.contains('active')) {
        if (trendChartFull) trendChartFull.destroy();
        const monthData = {};
        expenses.forEach(e => {
            const month = e.date.substring(0, 7);
            monthData[month] = (monthData[month] || 0) + e.amount;
        });
        const months = Object.keys(monthData).sort();
        const trendValues = months.map(m => monthData[m]);
        trendChartFull = new Chart(ctxTrendFull.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Spending',
                    data: trendValues,
                    backgroundColor: '#4f46e5',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
                    x: { ticks: { color: '#64748b' }, grid: { display: false } }
                }
            }
        });
    }

    const ctxVelocity = document.getElementById('velocityChart');
    if (ctxVelocity && document.getElementById('analyticsSection').classList.contains('active')) {
        if (velocityChart) velocityChart.destroy();
        const dates = [...new Set(expenses.map(e => e.date))].sort();
        const dailyTotals = dates.map(d => expenses.filter(e => e.date === d).reduce((s, e) => s + e.amount, 0));
        velocityChart = new Chart(ctxVelocity.getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Spending Velocity',
                    data: dailyTotals,
                    borderColor: '#4f46e5',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
                    x: { ticks: { color: '#64748b' }, grid: { display: false } }
                }
            }
        });
    }
}

async function loadAIInsights() {
    const response = await fetch('/ai');
    const data = await response.json();
    const container = document.getElementById('aiSuggestions');
    if (container) {
        container.innerHTML = '';
        data.suggestions.forEach(s => {
            const div = document.createElement('div');
            div.style.background = '#f8fafc';
            div.style.padding = '0.875rem';
            div.style.borderRadius = '10px';
            div.style.fontSize = '0.8rem';
            div.style.color = '#475569';
            div.style.border = '1px solid #e2e8f0';
            div.innerText = s;
            container.appendChild(div);
        });
    }
    document.getElementById('healthScore').innerText = `${data.health_score}/10`;
}

async function loadPrediction() {
    const response = await fetch('/predict');
    const data = await response.json();
    const predEl = document.getElementById('predictionValue');
    if (predEl) {
        if (data.status === 'success') {
            predEl.innerText = `₹${data.prediction.toLocaleString()}`;
        } else if (data.status === 'no_data') {
            predEl.innerText = '₹0';
        } else {
            predEl.innerText = 'Analyzing...';
        }
    }
}

async function updateBudget() {
    const budget = document.getElementById('budgetInput').value;
    if (!budget) return;
    const response = await fetch('/update_budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: budget })
    });
    if (response.ok) {
        loadData();
        alert('Monthly budget updated!');
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete this transaction?')) return;
    const response = await fetch(`/delete/${id}`, { method: 'DELETE' });
    if (response.ok) loadData();
}

// Advanced Chat Bot
function toggleChat() {
    const panel = document.getElementById('chatPanel');
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;

    addChatMessage(text, 'user');
    input.value = '';

    // Show typing
    const typingId = Date.now();
    addChatMessage("AI is thinking...", 'bot', typingId);

    setTimeout(async () => {
        const botMsg = document.getElementById(typingId);
        let reply = getSmartResponse(text.toLowerCase());
        botMsg.innerText = reply;
    }, 800);
}

function getSmartResponse(query) {
    // 1. Basic Greetings
    if (query.match(/hi|hello|hey|hola/)) return "Hello! I'm your Smart Spend AI Assistant. How can I help you manage your money today?";
    
    // 2. Savings Advice
    if (query.match(/save|saving|money tips/)) return "To boost savings: 1. Review your 'Subscriptions'—cancel what you don't use. 2. Try the 50/30/20 rule. 3. Monitor your 'Food & Dining' costs—they usually have the most room for optimization.";
    
    // 3. Budgeting
    if (query.match(/budget|limit|threshold/)) return "You can set your monthly limit in the 'Settings' tab. A good rule of thumb is to keep your fixed costs (Rent, Bills) under 50% of your income.";
    
    // 4. Investment
    if (query.match(/invest|stock|mutual fund|crypto/)) return "Investing is key to long-term wealth. Consider starting with low-cost Index Funds or a diversified Mutual Fund portfolio. Always maintain an emergency fund first!";
    
    // 5. Debt
    if (query.match(/debt|loan|credit card/)) return "Focus on high-interest debt first (like credit cards). The 'Snowball' or 'Avalanche' methods are popular strategies for debt reduction.";
    
    // 6. Expense tracking
    if (query.match(/track|transaction|history/)) return "Your 'History' tab shows every log. Adding expenses immediately after purchase ensures the best accuracy for our AI models.";
    
    // 7. General Error/Fallback
    return "I'm here to help! You can ask me about 'how to save money', 'setting a budget', 'investment advice', or 'tracking expenses'. What else would you like to know?";
}

function addChatMessage(text, sender, id = null) {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    if (id) div.id = id;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

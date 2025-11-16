document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & CONFIG ---
    const state = {
        currentStep: 0,
        evaluationType: null,
        mcqAnswers: {},
        ideaText: '',
        isLoading: false
    };

    const questionPaths = {
        initial: {
            key: 'type',
            question: 'What are you planning to evaluate?',
            options: [
                { text: 'A new Startup Idea', value: 'startup' },
                { text: 'A Personal Project', value: 'project' },
                { text: 'A new Feature for an existing product', value: 'feature' }
            ]
        },
        startup: [
            { key: 'funding', question: 'What is your primary funding goal?', options: ['Bootstrapped (Self-funded)', 'Angel Investment / Pre-Seed', 'Venture Capital (VC)', 'Not Decided'] },
            { key: 'model', question: 'What is the primary business model?', options: ['SaaS (Subscription)', 'E-commerce', 'Marketplace', 'API / Usage-based', 'Other'] }
        ],
        project: [
            { key: 'timeline', question: 'What is the estimated timeline?', options: ['Under 1 Month', '1-3 Months', '3+ Months'] },
            { key: 'goal', question: 'What is the main goal of this project?', options: ['Learning a new skill', 'Building a portfolio piece', 'Open Source contribution', 'Personal use'] }
        ],
        feature: [
            { key: 'metric', question: 'Which primary metric will this feature improve?', options: ['User Engagement', 'Revenue', 'User Retention', 'Acquisition'] },
            { key: 'complexity', question: 'How complex is the technical implementation?', options: ['Low (A few days)', 'Medium (1-2 weeks)', 'High (A month or more)'] }
        ]
    };

    // --- DOM ELEMENTS ---
    const DOMElements = {
        views: { 
            landing: document.getElementById('landing-view'), 
            mcq: document.getElementById('mcq-view'), 
            detail: document.getElementById('detail-view'), 
            loading: document.getElementById('loading-view'), 
            results: document.getElementById('results-view'), 
            error: document.getElementById('error-view') 
        },
        startBtn: document.getElementById('start-btn'),
        mcqContent: document.getElementById('mcq-content'),
        progressBar: document.getElementById('progress-bar'),
        ideaTextArea: document.getElementById('idea-text-area'),
        detailBackBtn: document.getElementById('detail-back-btn'),
        submitBtn: document.getElementById('submit-btn'),
        restartBtns: document.querySelectorAll('#restart-btn, #error-restart-btn'),
        errorMessage: document.getElementById('error-message'),
        results: { 
            overallRating: document.getElementById('overall-rating'), 
            successProbability: document.getElementById('success-probability'), 
            founderFitScore: document.getElementById('founder-fit-score'), 
            prosList: document.getElementById('pros-list'), 
            consList: document.getElementById('cons-list'),
            marketPotential: document.getElementById('market-potential'),
            competitionLevel: document.getElementById('competition-level'),
            feasibilityLevel: document.getElementById('feasibility-level')
        }
    };

    // --- CHART INSTANCES ---
    let chartInstances = {
        overall: null,
        probability: null,
        founder: null,
        radar: null,
        comparison: null
    };

    // --- CORE LOGIC ---
    const showView = (viewToShow) => {
        Object.values(DOMElements.views).forEach(view => view.classList.add('hidden'));
        viewToShow.classList.remove('hidden');
    };

    const renderCurrentQuestion = () => {
        let questionData;
        let totalSteps;
        
        if (!state.evaluationType) {
            questionData = questionPaths.initial;
            totalSteps = Object.keys(questionPaths).length - 1;
        } else {
            const path = questionPaths[state.evaluationType];
            questionData = path[state.currentStep];
            totalSteps = path.length;
        }

        const progress = state.evaluationType ? ((state.currentStep + 1) / totalSteps) * 100 : 0;
        DOMElements.progressBar.style.width = `${progress}%`;

        const optionsHTML = questionData.options.map(option => {
            const value = typeof option === 'string' ? option : option.value;
            const text = typeof option === 'string' ? option : option.text;
            return `<button class="btn mcq-option-btn" data-value="${value}">${text}</button>`;
        }).join('');

        DOMElements.mcqContent.innerHTML = `
            <div class="view">
                <h2>${questionData.question}</h2>
                <div class="mcq-options">${optionsHTML}</div>
                <button id="mcq-back-btn" class="btn btn-secondary" style="margin-top: 1rem;">Back</button>
            </div>
        `;
    };

    const handleMCQAnswer = (value) => {
        if (!state.evaluationType) {
            state.evaluationType = value;
            state.mcqAnswers[questionPaths.initial.key] = value;
            state.currentStep = 0;
            renderCurrentQuestion();
        } else {
            const path = questionPaths[state.evaluationType];
            const questionKey = path[state.currentStep].key;
            state.mcqAnswers[questionKey] = value;

            if (state.currentStep < path.length - 1) {
                state.currentStep++;
                renderCurrentQuestion();
            } else {
                showView(DOMElements.views.detail);
            }
        }
    };
    
    const handleMCQBack = () => {
        if (state.currentStep === 0 && state.evaluationType) {
            state.evaluationType = null;
            state.mcqAnswers = {};
            renderCurrentQuestion();
        } else if (state.currentStep > 0) {
            state.currentStep--;
            renderCurrentQuestion();
        } else {
            showView(DOMElements.views.landing);
        }
    };
    
    const submitForEvaluation = async () => {
        if (state.isLoading) return;
        state.ideaText = DOMElements.ideaTextArea.value;
        if (!state.ideaText.trim()) { alert('Please describe your idea.'); return; }
        state.isLoading = true;
        showView(DOMElements.views.loading);
        
        const payload = {
            mcq_answers: state.mcqAnswers,
            idea_text: state.ideaText,
        };

        try {
            const response = await fetch('/api/evaluate', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            if (!response.ok) { 
                const errorData = await response.json(); 
                throw new Error(errorData.detail || `HTTP error!`); 
            }
            const result = await response.json();
            renderResults(result);
            showView(DOMElements.views.results);
        } catch (error) { 
            DOMElements.errorMessage.textContent = error.message; 
            showView(DOMElements.views.error); 
        } finally { 
            state.isLoading = false; 
        }
    };
    
    // --- CHART RENDERING FUNCTIONS ---
    const createProgressRing = (canvasId, percentage, maxValue = 10) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 60;
        const lineWidth = 12;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.1)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        
        // Progress arc
        const normalizedPercentage = maxValue ? (percentage / maxValue) : (percentage / 100);
        const endAngle = -Math.PI / 2 + (2 * Math.PI * normalizedPercentage);
        
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#FFA500');
        gradient.addColorStop(1, '#FF4500');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Animate
        animateValue(canvasId, 0, percentage, 1500, maxValue);
        
        return ctx;
    };
    
    const animateValue = (canvasId, start, end, duration, maxValue = 10) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (end - start) * progress;
            
            const ctx = canvas.getContext('2d');
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 60;
            const lineWidth = 12;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Background circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.1)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            // Progress arc
            const normalizedPercentage = maxValue ? (current / maxValue) : (current / 100);
            const endAngle = -Math.PI / 2 + (2 * Math.PI * normalizedPercentage);
            
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#FFA500');
            gradient.addColorStop(1, '#FF4500');
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    };
    
    const createRadarChart = (data) => {
        const canvas = document.getElementById('radar-chart');
        if (!canvas) return;
        
        if (chartInstances.radar) {
            chartInstances.radar.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        chartInstances.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Score',
                    data: data.values,
                    backgroundColor: 'rgba(255, 165, 0, 0.2)',
                    borderColor: '#FF4500',
                    borderWidth: 2,
                    pointBackgroundColor: '#FFA500',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#FF4500',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            stepSize: 2,
                            color: '#A9A9A9',
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: 'rgba(255, 165, 0, 0.1)'
                        },
                        pointLabels: {
                            color: '#F5F5F5',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    };
    
    const createComparisonChart = (data) => {
        const canvas = document.getElementById('comparison-chart');
        if (!canvas) return;
        
        if (chartInstances.comparison) {
            chartInstances.comparison.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        chartInstances.comparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Score',
                    data: data.values,
                    backgroundColor: data.values.map((_, i) => {
                        const gradient = ctx.createLinearGradient(0, 0, 400, 0);
                        gradient.addColorStop(0, '#FFA500');
                        gradient.addColorStop(1, '#FF4500');
                        return gradient;
                    }),
                    borderRadius: 8,
                    barThickness: 30
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 10,
                        grid: {
                            color: 'rgba(255, 165, 0, 0.1)'
                        },
                        ticks: {
                            color: '#A9A9A9'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#F5F5F5',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    };
    
    const renderResults = (result) => {
        const escapeHTML = (str) => { 
            const p = document.createElement('p'); 
            p.textContent = str; 
            return p.innerHTML; 
        };
        
        // Update basic scores
        DOMElements.results.overallRating.textContent = result.overall_rating.toFixed(1);
        DOMElements.results.successProbability.textContent = `${result.success_probability}%`;
        DOMElements.results.founderFitScore.textContent = `${result.founder_fit_score}%`;
        
        // Update summary metrics (with fallback values)
        DOMElements.results.marketPotential.textContent = result.market_potential || 'High';
        DOMElements.results.competitionLevel.textContent = result.competition_level || 'Medium';
        DOMElements.results.feasibilityLevel.textContent = result.feasibility_level || 'High';
        
        // Create progress rings
        createProgressRing('overall-chart', result.overall_rating, 10);
        createProgressRing('probability-chart', result.success_probability, 100);
        createProgressRing('founder-chart', result.founder_fit_score, 100);
        
        // Render pros with weight indicators
        DOMElements.results.prosList.innerHTML = result.pros.map((item, index) => {
            const weight = Math.min(90, 60 + (index * 10)); // Varying weights for demo
            return `
                <li>
                    ${escapeHTML(item)}
                    <div class="weight-indicator">
                        <div class="weight-fill" style="animation: fillWidth 1s ease-out ${0.5 + index * 0.1}s forwards; width: ${weight}%;"></div>
                    </div>
                </li>
            `;
        }).join('');
        
        // Render cons with weight indicators
        DOMElements.results.consList.innerHTML = result.cons.map((item, index) => {
            const weight = Math.min(90, 50 + (index * 15)); // Varying weights for demo
            return `
                <li>
                    ${escapeHTML(item)}
                    <div class="weight-indicator">
                        <div class="weight-fill" style="animation: fillWidth 1s ease-out ${0.5 + index * 0.1}s forwards; width: ${weight}%;"></div>
                    </div>
                </li>
            `;
        }).join('');
        
        // Create radar chart (with fallback data if not provided by API)
        const radarData = result.score_breakdown || {
            labels: ['Market Potential', 'Technical Feasibility', 'Competition', 'Scalability', 'Innovation', 'Resources'],
            values: [8, 7, 6, 8, 9, 7]
        };
        createRadarChart(radarData);
        
        // Create comparison chart (with fallback data if not provided by API)
        const comparisonData = result.aspect_comparison || {
            labels: ['Market Size', 'Team Readiness', 'Product Viability', 'Financial Plan', 'Go-to-Market'],
            values: [8, 7, 9, 6, 8]
        };
        createComparisonChart(comparisonData);
        
        // Add fill animation for weight indicators
        const style = document.createElement('style');
        style.textContent = '@keyframes fillWidth { from { width: 0%; } }';
        document.head.appendChild(style);
    };

    // --- EVENT LISTENERS ---
    DOMElements.startBtn.addEventListener('click', () => {
        showView(DOMElements.views.mcq);
        renderCurrentQuestion();
    });

    DOMElements.mcqContent.addEventListener('click', (e) => {
        if (e.target.matches('.mcq-option-btn')) { 
            handleMCQAnswer(e.target.dataset.value); 
        } else if (e.target.matches('#mcq-back-btn')) { 
            handleMCQBack(); 
        }
    });

    DOMElements.detailBackBtn.addEventListener('click', () => {
        showView(DOMElements.views.mcq);
        renderCurrentQuestion();
    });

    DOMElements.submitBtn.addEventListener('click', submitForEvaluation);
    DOMElements.restartBtns.forEach(btn => btn.addEventListener('click', () => location.reload()));

    // --- INITIALIZATION ---
    showView(DOMElements.views.landing);
});
// Global state
let flashcards = [];
let currentCardIndex = 0;
let quizStartTime = null;
let questionStartTimes = {};
let performanceData = {
    totalTime: 0,
    questionTimes: [],
    correctAnswers: 0,
    incorrectAnswers: 0,
    cardResponses: {}
};

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const uploadScreen = document.getElementById('upload-screen');
const quizScreen = document.getElementById('quiz-screen');
const progressScreen = document.getElementById('progress-screen');

const startBtn = document.getElementById('start-btn');
const browseBtn = document.getElementById('browse-btn');
const pdfInput = document.getElementById('pdf-input');
const uploadArea = document.getElementById('upload-area');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const fileInfo = document.getElementById('file-info');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const revealBtn = document.getElementById('reveal-btn');
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');
const flashcard = document.getElementById('flashcard');
const flashcardInner = document.getElementById('flashcard-inner');
const questionText = document.getElementById('question-text');
const answerText = document.getElementById('answer-text');
const currentCardSpan = document.getElementById('current-card');
const totalCardsSpan = document.getElementById('total-cards');
const quizTimer = document.getElementById('quiz-timer');
const cardIndicators = document.getElementById('card-indicators');

const viewProgressBtn = document.getElementById('view-progress-btn');
const backToQuizBtn = document.getElementById('back-to-quiz-btn');
const newSessionBtn = document.getElementById('new-session-btn');

// Event Listeners
startBtn.addEventListener('click', () => {
    showScreen('upload-screen');
});

browseBtn.addEventListener('click', () => {
    pdfInput.click();
});

pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handlePDFUpload(e.target.files[0]);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handlePDFUpload(file);
    } else {
        alert('Please upload a PDF file.');
    }
});

prevBtn.addEventListener('click', () => {
    if (currentCardIndex > 0) {
        saveQuestionTime();
        currentCardIndex--;
        updateFlashcard();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentCardIndex < flashcards.length - 1) {
        saveQuestionTime();
        currentCardIndex++;
        updateFlashcard();
    }
});

revealBtn.addEventListener('click', () => {
    flashcard.classList.add('flipped');
    revealBtn.classList.add('hidden');
    correctBtn.classList.remove('hidden');
    incorrectBtn.classList.remove('hidden');
});

correctBtn.addEventListener('click', () => {
    recordAnswer(true);
    resetCardState();
    if (currentCardIndex < flashcards.length - 1) {
        setTimeout(() => {
            currentCardIndex++;
            updateFlashcard();
        }, 500);
    } else {
        showProgressScreen();
    }
});

incorrectBtn.addEventListener('click', () => {
    recordAnswer(false);
    resetCardState();
    if (currentCardIndex < flashcards.length - 1) {
        setTimeout(() => {
            currentCardIndex++;
            updateFlashcard();
        }, 500);
    } else {
        showProgressScreen();
    }
});

viewProgressBtn.addEventListener('click', () => {
    showProgressScreen();
});

backToQuizBtn.addEventListener('click', () => {
    showScreen('quiz-screen');
});

newSessionBtn.addEventListener('click', () => {
    resetQuiz();
    showScreen('upload-screen');
});

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// PDF Upload and Processing
async function handlePDFUpload(file) {
    uploadProgress.classList.remove('hidden');
    progressFill.style.width = '0%';
    
    try {
        // Request file system permissions (if needed)
        if (file && !file.webkitRelativePath) {
            // File is from input, proceed
        }
        
        progressFill.style.width = '30%';
        
        const arrayBuffer = await file.arrayBuffer();
        progressFill.style.width = '50%';
        
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        progressFill.style.width = '70%';
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + ' ';
            progressFill.style.width = `${70 + (i / numPages) * 20}%`;
        }
        
        progressFill.style.width = '100%';
        
        // Generate flashcards from text
        flashcards = generateFlashcards(fullText);
        
        if (flashcards.length === 0) {
            alert('Could not generate flashcards from this PDF. Please try another file.');
            uploadProgress.classList.add('hidden');
            return;
        }
        
        fileInfo.innerHTML = `
            <h3>✅ PDF Processed Successfully!</h3>
            <p>Generated ${flashcards.length} flashcards from your document.</p>
            <button class="btn-primary" onclick="startQuiz()" style="margin-top: 1rem;">Start Quiz</button>
        `;
        fileInfo.classList.remove('hidden');
        uploadProgress.classList.add('hidden');
        
    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF. Please try again.');
        uploadProgress.classList.add('hidden');
    }
}

// Flashcard Generation
function generateFlashcards(text) {
    // Clean and process text
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length < 8) {
        // If not enough sentences, split by paragraphs or create questions from key phrases
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
        return generateFromParagraphs(paragraphs);
    }
    
    const numCards = Math.min(Math.max(8, Math.floor(sentences.length / 3)), 12);
    const selectedSentences = selectDiverseSentences(sentences, numCards);
    
    return selectedSentences.map((sentence, index) => {
        const question = generateQuestion(sentence);
        const answer = sentence.trim();
        return {
            id: index + 1,
            question: question,
            answer: answer
        };
    });
}

function generateFromParagraphs(paragraphs) {
    const numCards = Math.min(Math.max(8, paragraphs.length), 12);
    const selected = paragraphs.slice(0, numCards);
    
    return selected.map((para, index) => {
        const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const mainSentence = sentences[0] || para.substring(0, 200);
        const question = generateQuestion(mainSentence);
        const answer = para.trim().substring(0, 300);
        
        return {
            id: index + 1,
            question: question,
            answer: answer
        };
    });
}

function selectDiverseSentences(sentences, count) {
    const step = Math.floor(sentences.length / count);
    const selected = [];
    for (let i = 0; i < sentences.length && selected.length < count; i += step) {
        if (sentences[i] && sentences[i].trim().length > 30) {
            selected.push(sentences[i]);
        }
    }
    return selected.slice(0, count);
}

function generateQuestion(sentence) {
    // Simple question generation algorithm
    const trimmed = sentence.trim();
    
    // Try to find key terms
    const words = trimmed.split(/\s+/);
    if (words.length < 5) {
        return `What does this statement describe: "${trimmed.substring(0, 100)}..."?`;
    }
    
    // Look for definition patterns
    if (trimmed.toLowerCase().includes('is defined as') || trimmed.toLowerCase().includes('refers to')) {
        const parts = trimmed.split(/is defined as|refers to/i);
        if (parts.length > 1) {
            return `What is ${parts[0].trim()}?`;
        }
    }
    
    // Look for "is" statements
    const isMatch = trimmed.match(/^(.+?)\s+is\s+(.+)$/i);
    if (isMatch) {
        return `What is ${isMatch[1].trim()}?`;
    }
    
    // Look for "are" statements
    const areMatch = trimmed.match(/^(.+?)\s+are\s+(.+)$/i);
    if (areMatch) {
        return `What are ${areMatch[1].trim()}?`;
    }
    
    // Default: create a fill-in-the-blank or summary question
    const keyWords = words.filter(w => w.length > 4).slice(0, 3);
    if (keyWords.length > 0) {
        return `Explain the concept related to: ${keyWords.join(', ')}`;
    }
    
    return `What is the main idea of: "${trimmed.substring(0, 80)}..."?`;
}

// Quiz Functions
function startQuiz() {
    resetQuiz();
    showScreen('quiz-screen');
    updateFlashcard();
    startTimer();
    questionStartTimes[currentCardIndex] = Date.now();
}

function resetQuiz() {
    currentCardIndex = 0;
    quizStartTime = Date.now();
    questionStartTimes = {};
    performanceData = {
        totalTime: 0,
        questionTimes: [],
        correctAnswers: 0,
        incorrectAnswers: 0,
        cardResponses: {}
    };
    updateCardIndicators();
}

function updateFlashcard() {
    if (flashcards.length === 0) return;
    
    const card = flashcards[currentCardIndex];
    questionText.textContent = card.question;
    answerText.textContent = card.answer;
    
    currentCardSpan.textContent = currentCardIndex + 1;
    totalCardsSpan.textContent = flashcards.length;
    
    // Reset card state
    flashcard.classList.remove('flipped');
    revealBtn.classList.remove('hidden');
    correctBtn.classList.add('hidden');
    incorrectBtn.classList.add('hidden');
    
    // Update navigation buttons
    prevBtn.disabled = currentCardIndex === 0;
    nextBtn.disabled = currentCardIndex === flashcards.length - 1;
    
    // Start timing for this question
    questionStartTimes[currentCardIndex] = Date.now();
    
    updateCardIndicators();
}

function saveQuestionTime() {
    if (questionStartTimes[currentCardIndex] !== undefined) {
        const timeSpent = Date.now() - questionStartTimes[currentCardIndex];
        performanceData.questionTimes[currentCardIndex] = timeSpent;
    }
}

function recordAnswer(isCorrect) {
    saveQuestionTime();
    
    if (isCorrect) {
        performanceData.correctAnswers++;
        performanceData.cardResponses[currentCardIndex] = 'correct';
    } else {
        performanceData.incorrectAnswers++;
        performanceData.cardResponses[currentCardIndex] = 'incorrect';
    }
    
    updateCardIndicators();
}

function resetCardState() {
    setTimeout(() => {
        flashcard.classList.remove('flipped');
    }, 300);
}

function updateCardIndicators() {
    cardIndicators.innerHTML = '';
    flashcards.forEach((card, index) => {
        const indicator = document.createElement('div');
        indicator.className = 'indicator';
        if (index === currentCardIndex) {
            indicator.classList.add('active');
        }
        if (performanceData.cardResponses[index]) {
            indicator.classList.add(performanceData.cardResponses[index]);
        }
        indicator.addEventListener('click', () => {
            if (index !== currentCardIndex) {
                saveQuestionTime();
                currentCardIndex = index;
                updateFlashcard();
            }
        });
        cardIndicators.appendChild(indicator);
    });
}

// Timer
let timerInterval = null;

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (quizStartTime) {
            const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            quizTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

// Progress Screen
function showProgressScreen() {
    saveQuestionTime();
    performanceData.totalTime = Date.now() - quizStartTime;
    
    calculateAndDisplayStats();
    showScreen('progress-screen');
}

function calculateAndDisplayStats() {
    // Total time
    const totalSeconds = Math.floor(performanceData.totalTime / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalSecs = totalSeconds % 60;
    document.getElementById('total-time').textContent = 
        `${String(totalMinutes).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;
    
    // Average time per question
    const answeredQuestions = performanceData.questionTimes.filter(t => t > 0);
    const avgTime = answeredQuestions.length > 0 
        ? answeredQuestions.reduce((a, b) => a + b, 0) / answeredQuestions.length 
        : 0;
    const avgSeconds = Math.floor(avgTime / 1000);
    const avgMins = Math.floor(avgSeconds / 60);
    const avgSecs = avgSeconds % 60;
    document.getElementById('avg-time').textContent = 
        `${String(avgMins).padStart(2, '0')}:${String(avgSecs).padStart(2, '0')}`;
    
    // Correct/Incorrect counts
    document.getElementById('correct-count').textContent = performanceData.correctAnswers;
    document.getElementById('incorrect-count').textContent = performanceData.incorrectAnswers;
    
    // Accuracy
    const totalAnswered = performanceData.correctAnswers + performanceData.incorrectAnswers;
    const accuracy = totalAnswered > 0 
        ? Math.round((performanceData.correctAnswers / totalAnswered) * 100) 
        : 0;
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    
    // Cards reviewed
    document.getElementById('cards-reviewed').textContent = totalAnswered;
    
    // Charts
    updateCharts();
}

function updateCharts() {
    // Time per question chart
    const timeCtx = document.getElementById('time-chart').getContext('2d');
    const timeLabels = flashcards.map((_, i) => `Card ${i + 1}`);
    const timeData = flashcards.map((_, i) => 
        performanceData.questionTimes[i] ? Math.floor(performanceData.questionTimes[i] / 1000) : 0
    );
    
    if (window.timeChart) {
        window.timeChart.destroy();
    }
    
    window.timeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Time (seconds)',
                data: timeData,
                backgroundColor: 'rgba(184, 214, 255, 0.8)',
                borderColor: 'rgba(138, 184, 255, 1)',
                borderWidth: 2,
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + 's';
                        }
                    }
                }
            }
        }
    });
    
    // Performance overview chart
    const perfCtx = document.getElementById('performance-chart').getContext('2d');
    const totalAnswered = performanceData.correctAnswers + performanceData.incorrectAnswers;
    
    if (window.perfChart) {
        window.perfChart.destroy();
    }
    
    window.perfChart = new Chart(perfCtx, {
        type: 'doughnut',
        data: {
            labels: ['Correct', 'Incorrect', 'Not Answered'],
            datasets: [{
                data: [
                    performanceData.correctAnswers,
                    performanceData.incorrectAnswers,
                    flashcards.length - totalAnswered
                ],
                backgroundColor: [
                    'rgba(214, 255, 232, 0.8)',
                    'rgba(255, 230, 214, 0.8)',
                    'rgba(240, 240, 240, 0.8)'
                ],
                borderColor: [
                    'rgba(184, 255, 214, 1)',
                    'rgba(255, 200, 184, 1)',
                    'rgba(200, 200, 200, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Make startQuiz available globally
window.startQuiz = startQuiz;


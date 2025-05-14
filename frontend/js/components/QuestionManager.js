class QuestionManager {
    constructor(containerId, testId) {
        this.container = document.getElementById(containerId);
        this.testId = testId;
        this.questions = [];
        this.init();
    }

    async init() {
        this.render();
        await this.loadQuestions();
    }

    async loadQuestions() {
        try {
            const response = await fetch(`/api/questions/test/${this.testId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) throw new Error('Failed to load questions');
            
            this.questions = await response.json();
            this.renderQuestions();
        } catch (error) {
            console.error('Error loading questions:', error);
            alert('Failed to load questions');
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="question-manager">
                <h2>Test Questions</h2>
                <button class="btn btn-primary mb-3" onclick="questionManager.showAddQuestionModal()">
                    Add Question
                </button>
                <div id="questionsList" class="questions-list"></div>
            </div>

            <!-- Add/Edit Question Modal -->
            <div class="modal fade" id="questionModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add Question</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="questionForm">
                                <div class="mb-3">
                                    <label class="form-label">Question Type</label>
                                    <select class="form-select" id="questionType" onchange="questionManager.toggleQuestionType()">
                                        <option value="multiple_choice">Multiple Choice</option>
                                        <option value="freeform">Freeform</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Question Text</label>
                                    <textarea class="form-control" id="questionText" rows="3" required></textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Points</label>
                                    <input type="number" class="form-control" id="points" value="1" min="1" required>
                                </div>
                                <div id="multipleChoiceOptions" class="mb-3">
                                    <label class="form-label">Options</label>
                                    <div id="optionsList"></div>
                                    <button type="button" class="btn btn-secondary mt-2" onclick="questionManager.addOption()">
                                        Add Option
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="questionManager.saveQuestion()">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.modal = new bootstrap.Modal(document.getElementById('questionModal'));
    }

    renderQuestions() {
        const questionsList = document.getElementById('questionsList');
        questionsList.innerHTML = this.questions.map((q, index) => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <h5 class="card-title">Question ${index + 1}</h5>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="questionManager.editQuestion(${q.id})">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="questionManager.deleteQuestion(${q.id})">
                                Delete
                            </button>
                        </div>
                    </div>
                    <p class="card-text">${q.question_text}</p>
                    <p class="card-text">
                        <small class="text-muted">
                            Type: ${q.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Freeform'} | 
                            Points: ${q.points}
                        </small>
                    </p>
                    ${q.question_type === 'multiple_choice' ? this.renderOptions(q.options) : ''}
                </div>
            </div>
        `).join('');
    }

    renderOptions(options) {
        return `
            <div class="options-list">
                ${options.map(opt => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" disabled ${opt.is_correct ? 'checked' : ''}>
                        <label class="form-check-label">
                            ${opt.option_text}
                            ${opt.is_correct ? '<span class="badge bg-success ms-2">Correct</span>' : ''}
                        </label>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showAddQuestionModal() {
        document.getElementById('questionForm').reset();
        document.getElementById('questionType').value = 'multiple_choice';
        this.toggleQuestionType();
        this.modal.show();
    }

    toggleQuestionType() {
        const type = document.getElementById('questionType').value;
        const optionsDiv = document.getElementById('multipleChoiceOptions');
        optionsDiv.style.display = type === 'multiple_choice' ? 'block' : 'none';
    }

    addOption() {
        const optionsList = document.getElementById('optionsList');
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item mb-2';
        optionDiv.innerHTML = `
            <div class="input-group">
                <input type="text" class="form-control" placeholder="Option text" required>
                <div class="input-group-text">
                    <input type="radio" name="correctOption" required>
                </div>
                <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">
                    Remove
                </button>
            </div>
        `;
        optionsList.appendChild(optionDiv);
    }

    async saveQuestion() {
        const form = document.getElementById('questionForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const questionData = {
            test_id: this.testId,
            question_text: document.getElementById('questionText').value,
            question_type: document.getElementById('questionType').value,
            points: parseInt(document.getElementById('points').value),
            order_index: this.questions.length
        };

        if (questionData.question_type === 'multiple_choice') {
            const options = Array.from(document.getElementById('optionsList').children).map((div, index) => ({
                option_text: div.querySelector('input[type="text"]').value,
                is_correct: div.querySelector('input[type="radio"]').checked,
                order_index: index
            }));

            if (options.length < 2) {
                alert('Please add at least 2 options');
                return;
            }

            if (!options.some(opt => opt.is_correct)) {
                alert('Please select a correct answer');
                return;
            }

            questionData.options = options;
        }

        try {
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(questionData)
            });

            if (!response.ok) throw new Error('Failed to save question');

            this.modal.hide();
            await this.loadQuestions();
        } catch (error) {
            console.error('Error saving question:', error);
            alert('Failed to save question');
        }
    }

    async editQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        document.getElementById('questionText').value = question.question_text;
        document.getElementById('questionType').value = question.question_type;
        document.getElementById('points').value = question.points;

        this.toggleQuestionType();

        if (question.question_type === 'multiple_choice') {
            const optionsList = document.getElementById('optionsList');
            optionsList.innerHTML = '';
            question.options.forEach(opt => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option-item mb-2';
                optionDiv.innerHTML = `
                    <div class="input-group">
                        <input type="text" class="form-control" value="${opt.option_text}" required>
                        <div class="input-group-text">
                            <input type="radio" name="correctOption" ${opt.is_correct ? 'checked' : ''} required>
                        </div>
                        <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.parentElement.remove()">
                            Remove
                        </button>
                    </div>
                `;
                optionsList.appendChild(optionDiv);
            });
        }

        this.modal.show();
    }

    async deleteQuestion(questionId) {
        if (!confirm('Are you sure you want to delete this question?')) return;

        try {
            const response = await fetch(`/api/questions/${questionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete question');

            await this.loadQuestions();
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Failed to delete question');
        }
    }
} 
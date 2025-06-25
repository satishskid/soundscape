// Hearing Screening App - Main JavaScript

class HearingScreenApp {
    constructor() {
        this.currentScreen = 'welcome-screen';
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.currentToneTimeout = null;
        
        // Test data from JSON
        this.testFrequencies = [250, 500, 1000, 2000, 4000, 8000];
        this.frequencyDescriptions = {
            250: "Deep truck engine",
            500: "Foghorn sound", 
            1000: "Phone ringing",
            2000: "Alarm beeping",
            4000: "High whistle",
            8000: "Cricket chirping"
        };
        this.hearingLevels = [-10, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];
        this.hearingClassifications = {
            "normal": {"range": [-10, 25], "color": "#22C55E", "description": "Normal hearing"},
            "mild": {"range": [26, 40], "color": "#FCD34D", "description": "Mild hearing loss"},
            "moderate": {"range": [41, 55], "color": "#F97316", "description": "Moderate hearing loss"},
            "moderately_severe": {"range": [56, 70], "color": "#EF4444", "description": "Moderately severe hearing loss"},
            "severe": {"range": [71, 90], "color": "#DC2626", "description": "Severe hearing loss"},
            "profound": {"range": [91, 120], "color": "#991B1B", "description": "Profound hearing loss"}
        };
        
        // Patient data
        this.patientData = {
            name: '',
            age: null,
            gender: '',
            id: '',
            hasHearingHistory: false,
            isAnonymous: false
        };
        
        // Test state
        this.testResults = {
            right: {},  // frequency: threshold
            left: {}
        };
        this.currentEar = 'right';
        this.currentFrequencyIndex = 0;
        this.currentLevel = 40; // Start at 40 dB HL
        this.testProgress = 0;
        this.isPaused = false;
        this.noResponseCount = 0;
        this.isChildMode = false;
        this.currentSoundNumber = 1;
        this.totalSoundsForFrequency = 12; // Approximate sounds per frequency
        this.waitingForResponse = false;
        this.responseTimeout = null;
        
        // Environment checks
        this.environmentChecks = {
            noise: false,
            headphone: false,
            calibration: false
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.showScreen('welcome-screen');
        this.initAudioContext();
    }
    
    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = 0.5; // 50% volume
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            this.showAlert('Audio not supported in this browser');
        }
    }
    
    setupEventListeners() {
        // Welcome screen
        document.getElementById('consent-checkbox').addEventListener('change', (e) => {
            document.getElementById('start-btn').disabled = !e.target.checked;
        });
        
        document.getElementById('start-btn').addEventListener('click', () => {
            this.showScreen('environment-screen');
            this.startEnvironmentChecks();
        });
        
        // Environment screen
        document.getElementById('headphone-test-btn').addEventListener('click', () => {
            this.testHeadphones();
        });
        
        document.getElementById('calibration-btn').addEventListener('click', () => {
            this.playCalibrationTone();
        });
        
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            if (this.gainNode) {
                this.gainNode.gain.value = volume;
            }
            document.getElementById('volume-display').textContent = e.target.value + '%';
        });
        
        document.getElementById('environment-continue-btn').addEventListener('click', () => {
            this.showScreen('preparation-screen');
        });
        
        // Preparation screen
        document.querySelectorAll('.prep-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updatePreparationButton();
            });
        });
        
        document.getElementById('preparation-continue-btn').addEventListener('click', () => {
            this.showScreen('patient-screen');
        });
        
        // Patient form
        document.getElementById('patient-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePatientForm();
        });
        
        // Instructions screen
        document.getElementById('sample-tone-btn').addEventListener('click', () => {
            this.playSampleTone();
        });
        
        document.getElementById('start-test-btn').addEventListener('click', () => {
            this.startHearingTest();
        });
        
        // Test screen
        document.getElementById('hear-btn').addEventListener('click', () => {
            this.handleResponse(true);
        });
        
        document.getElementById('no-hear-btn').addEventListener('click', () => {
            this.handleResponse(false);
        });
        
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.pauseTest();
        });
        
        document.getElementById('repeat-tone-btn').addEventListener('click', () => {
            this.repeatTone();
        });
        
        // Results screen
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportResults();
        });
        
        document.getElementById('share-btn').addEventListener('click', () => {
            this.shareResults();
        });
        
        document.getElementById('print-btn').addEventListener('click', () => {
            window.print();
        });
        
        document.getElementById('new-test-btn').addEventListener('click', () => {
            this.startNewTest();
        });
        
        document.getElementById('delete-data-btn').addEventListener('click', () => {
            this.deleteData();
        });
    }
    
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
        
        // Resume audio context if needed
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    showLoading(message) {
        document.getElementById('loading-text').textContent = message;
        document.getElementById('loading-overlay').classList.add('active');
    }
    
    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }
    
    showAlert(message) {
        alert(message); // Simple alert for now
    }
    
    // Environment Setup Methods
    async startEnvironmentChecks() {
        await this.checkAmbientNoise();
        this.updateEnvironmentStatus();
    }
    
    async checkAmbientNoise() {
        const noiseReading = document.getElementById('noise-reading');
        const noiseStatus = document.getElementById('noise-status');
        const noiseLevelBar = document.getElementById('noise-level-bar');
        
        noiseStatus.textContent = 'Checking...';
        noiseStatus.className = 'status-indicator checking';
        
        // Simulate ambient noise monitoring
        let currentNoise = Math.random() * 60; // 0-60 dB simulation
        
        const updateNoise = () => {
            currentNoise += (Math.random() - 0.5) * 10;
            currentNoise = Math.max(0, Math.min(60, currentNoise));
            
            noiseReading.textContent = Math.round(currentNoise) + ' dB';
            noiseLevelBar.style.setProperty('--noise-width', (currentNoise / 60 * 100) + '%');
            
            if (currentNoise <= 40) {
                noiseStatus.textContent = 'Environment is quiet enough';
                noiseStatus.className = 'status-indicator success';
                this.environmentChecks.noise = true;
            } else {
                noiseStatus.textContent = 'Too noisy - find quieter location';
                noiseStatus.className = 'status-indicator warning';
                this.environmentChecks.noise = false;
            }
            
            this.updateEnvironmentStatus();
        };
        
        // Update every 2 seconds
        setInterval(updateNoise, 2000);
        updateNoise(); // Initial update
    }
    
    async testHeadphones() {
        const status = document.getElementById('headphone-status');
        const button = document.getElementById('headphone-test-btn');
        
        button.disabled = true;
        status.textContent = 'Testing...';
        status.className = 'status-indicator checking';
        
        try {
            // Play a brief test tone
            await this.playTone(1000, 0.5, 1000);
            
            setTimeout(() => {
                status.textContent = 'Headphones detected';
                status.className = 'status-indicator success';
                this.environmentChecks.headphone = true;
                button.disabled = false;
                this.updateEnvironmentStatus();
            }, 1000);
            
        } catch (error) {
            status.textContent = 'Headphone test failed';
            status.className = 'status-indicator error';
            button.disabled = false;
        }
    }
    
    async playCalibrationTone() {
        const status = document.getElementById('calibration-status');
        const button = document.getElementById('calibration-btn');
        
        button.disabled = true;
        
        try {
            await this.playTone(1000, 0.5, 2000);
            
            setTimeout(() => {
                status.textContent = 'Calibration complete';
                status.className = 'status-indicator success';
                this.environmentChecks.calibration = true;
                button.disabled = false;
                this.updateEnvironmentStatus();
            }, 2000);
            
        } catch (error) {
            status.textContent = 'Calibration failed';
            status.className = 'status-indicator error';
            button.disabled = false;
        }
    }
    
    updateEnvironmentStatus() {
        const continueBtn = document.getElementById('environment-continue-btn');
        const allChecksPass = Object.values(this.environmentChecks).every(check => check);
        continueBtn.disabled = !allChecksPass;
    }
    
    updatePreparationButton() {
        const checkboxes = document.querySelectorAll('.prep-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        document.getElementById('preparation-continue-btn').disabled = !allChecked;
    }
    
    // Patient Data Methods
    handlePatientForm() {
        const formData = new FormData(document.getElementById('patient-form'));
        
        this.patientData.name = document.getElementById('patient-name').value;
        this.patientData.age = parseInt(document.getElementById('patient-age').value);
        this.patientData.gender = document.getElementById('patient-gender').value;
        this.patientData.id = document.getElementById('patient-id').value;
        this.patientData.hasHearingHistory = document.getElementById('hearing-history').checked;
        this.patientData.isAnonymous = document.getElementById('anonymize-data').checked;
        
        // Validate age
        if (!this.patientData.age || this.patientData.age < 4) {
            this.showAlert('Please enter a valid age (minimum 4 years)');
            return;
        }
        
        // Set interface mode based on age
        this.isChildMode = this.patientData.age < 18;
        
        if (this.isChildMode) {
            document.body.classList.add('child-mode');
            this.setupChildInstructions();
        }
        
        this.showScreen('instructions-screen');
    }
    
    setupChildInstructions() {
        document.getElementById('instruction-text-1').textContent = 
            "You'll hear special sounds! Some are loud, some are very quiet like whispers.";
        document.getElementById('instruction-text-2').textContent = 
            "When you hear any sound, tap the happy button right away!";
        document.getElementById('instruction-text-3').textContent = 
            "We'll check both ears. It's like a fun game that helps us learn about your hearing!";
    }
    
    // Audio Methods
    async playTone(frequency, volume = 0.5, duration = 1000) {
        if (!this.audioContext || this.isPlaying) return;
        
        // Stop any existing tone
        if (this.oscillator) {
            try {
                this.oscillator.stop();
            } catch (e) {
                // Oscillator might already be stopped
            }
            this.oscillator = null;
        }
        
        // Clear any existing tone timeout
        if (this.currentToneTimeout) {
            clearTimeout(this.currentToneTimeout);
        }
        
        this.isPlaying = true;
        
        this.oscillator = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();
        
        this.oscillator.frequency.value = frequency;
        this.oscillator.type = 'sine';
        
        envelope.gain.value = 0;
        envelope.gain.setValueAtTime(0, this.audioContext.currentTime);
        envelope.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
        envelope.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + duration / 1000 - 0.01);
        envelope.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration / 1000);
        
        this.oscillator.connect(envelope);
        envelope.connect(this.gainNode);
        
        this.oscillator.start();
        this.oscillator.stop(this.audioContext.currentTime + duration / 1000);
        
        return new Promise((resolve) => {
            this.currentToneTimeout = setTimeout(() => {
                this.isPlaying = false;
                this.oscillator = null;
                resolve();
            }, duration);
        });
    }
    
    async playSampleTone() {
        const button = document.getElementById('sample-tone-btn');
        button.disabled = true;
        button.textContent = '🔊 Playing...';
        
        await this.playTone(1000, 0.5, 1500);
        
        button.disabled = false;
        button.textContent = '🔊 Play Sample Tone';
    }
    
    // Hearing Test Methods
    async startHearingTest() {
        this.showLoading('Preparing hearing test...');
        
        // Initialize test state
        this.testResults = { right: {}, left: {} };
        this.currentEar = 'right';
        this.currentFrequencyIndex = 0;
        this.currentLevel = 40;
        this.testProgress = 0;
        this.isPaused = false;
        
        // Setup progress indicators
        this.setupProgressIndicators();
        
        setTimeout(() => {
            this.hideLoading();
            this.showScreen('test-screen');
            this.startFrequencyTest();
        }, 2000);
    }
    
    setupProgressIndicators() {
        const rightProgress = document.getElementById('right-ear-progress');
        const leftProgress = document.getElementById('left-ear-progress');
        
        rightProgress.innerHTML = '';
        leftProgress.innerHTML = '';
        
        this.testFrequencies.forEach((freq, index) => {
            const rightDot = document.createElement('div');
            rightDot.className = 'frequency-dot';
            rightDot.textContent = this.formatFrequency(freq);
            rightDot.id = `right-${freq}`;
            rightProgress.appendChild(rightDot);
            
            const leftDot = document.createElement('div');
            leftDot.className = 'frequency-dot';
            leftDot.textContent = this.formatFrequency(freq);
            leftDot.id = `left-${freq}`;
            leftProgress.appendChild(leftDot);
        });
    }
    
    formatFrequency(freq) {
        return freq >= 1000 ? (freq / 1000) + 'k' : freq.toString();
    }
    
    async startFrequencyTest() {
        if (this.isPaused) return;
        
        const frequency = this.testFrequencies[this.currentFrequencyIndex];
        
        // Update UI
        this.updateTestUI(frequency);
        
        // Mark current frequency as active
        const dotId = `${this.currentEar}-${frequency}`;
        document.querySelectorAll('.frequency-dot').forEach(dot => {
            dot.classList.remove('current');
        });
        document.getElementById(dotId).classList.add('current');
        
        // Start with 40 dB HL or previous threshold + 10
        this.currentLevel = 40;
        this.noResponseCount = 0;
        
        // Play initial tone
        await this.playTestTone(frequency);
    }
    
    updateTestUI(frequency) {
        document.getElementById('current-ear').textContent = 
            this.currentEar === 'right' ? 'Right Ear' : 'Left Ear';
        document.getElementById('current-ear-symbol').textContent = 
            this.currentEar === 'right' ? '👂' : '👂';
        document.getElementById('current-frequency').textContent = frequency + ' Hz';
        
        // Update frequency description
        const description = this.frequencyDescriptions[frequency] || 'Test tone';
        document.getElementById('current-frequency-desc').textContent = `(${description})`;
        
        // Update sound counter
        document.getElementById('current-sound-number').textContent = this.currentSoundNumber;
        
        // Update progress
        const totalTests = this.testFrequencies.length * 2; // Both ears
        const completedTests = Object.keys(this.testResults.right).length + 
                              Object.keys(this.testResults.left).length;
        this.testProgress = (completedTests / totalTests) * 100;
        
        document.getElementById('test-progress-bar').style.width = this.testProgress + '%';
        document.getElementById('progress-text').textContent = Math.round(this.testProgress) + '%';
    }
    
    async playTestTone(frequency) {
        if (this.isPaused || this.currentLevel > 100 || this.waitingForResponse) {
            // Don't start new tone if already waiting for response or paused
            if (this.currentLevel > 100) {
                this.recordThreshold(120); // Record as 120 dB HL (no response)
            }
            return;
        }
        
        // Stop any existing tone first
        if (this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator = null;
            } catch (e) {
                // Tone already stopped
            }
        }
        
        // Update UI
        this.updateTestUI(frequency);
        
        // Convert dB HL to volume (simplified conversion)
        const volume = this.dbHLToVolume(this.currentLevel);
        
        // Show listening indicator
        document.getElementById('listening-indicator').style.display = 'flex';
        
        // Clear any existing timeout
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
        
        // Set waiting flag BEFORE playing tone
        this.waitingForResponse = true;
        
        await this.playTone(frequency, volume, 1000);
        
        // Set timeout for no response (only if still waiting)
        if (this.waitingForResponse) {
            this.responseTimeout = setTimeout(() => {
                if (this.waitingForResponse) {
                    this.handleResponse(false); // No response = didn't hear
                }
            }, 5000);
        }
    }
    
    dbHLToVolume(dbHL) {
        // Simplified conversion from dB HL to volume (0-1)
        // This is a rough approximation for demonstration
        const minDB = -10;
        const maxDB = 100;
        const normalizedDB = Math.max(0, Math.min(1, (dbHL - minDB) / (maxDB - minDB)));
        return normalizedDB * 0.8; // Max 80% volume
    }
    
    handleResponse(heard) {
        if (!this.waitingForResponse) return;
        
        // Clear the timeout and reset flags FIRST
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
        
        this.waitingForResponse = false;
        document.getElementById('listening-indicator').style.display = 'none';
        
        // Stop any currently playing tone
        if (this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator = null;
            } catch (e) {
                // Tone already stopped
            }
        }
        
        // Increment sound counter
        this.currentSoundNumber++;
        
        const frequency = this.testFrequencies[this.currentFrequencyIndex];
        
        if (heard) {
            // Decrease level by 10 dB
            this.currentLevel -= 10;
            this.noResponseCount = 0;
            
            if (this.currentLevel < -10) {
                // Found threshold
                this.recordThreshold(this.currentLevel + 10);
                return; // Exit here to prevent further processing
            } else {
                // Continue testing at lower level after delay
                setTimeout(() => {
                    if (!this.waitingForResponse && !this.isPaused) {
                        this.playTestTone(frequency);
                    }
                }, 1000);
            }
        } else {
            // Increase level by 5 dB
            this.currentLevel += 5;
            this.noResponseCount++;
            
            if (this.noResponseCount >= 3 && this.currentLevel > 50) {
                // No response at high levels
                this.recordThreshold(this.currentLevel);
                return; // Exit here to prevent further processing
            } else {
                // Continue testing at higher level after delay
                setTimeout(() => {
                    if (!this.waitingForResponse && !this.isPaused) {
                        this.playTestTone(frequency);
                    }
                }, 1000);
            }
        }
    }
    
    recordThreshold(threshold) {
        const frequency = this.testFrequencies[this.currentFrequencyIndex];
        this.testResults[this.currentEar][frequency] = Math.min(120, Math.max(-10, threshold));
        
        // Mark frequency as completed
        const dotId = `${this.currentEar}-${frequency}`;
        const dot = document.getElementById(dotId);
        dot.classList.remove('current');
        dot.classList.add('completed');
        
        // Move to next frequency or ear
        this.moveToNextTest();
    }
    
    moveToNextTest() {
        // Reset all test state for new frequency
        this.currentFrequencyIndex++;
        this.currentSoundNumber = 1; // Reset counter for new frequency
        this.currentLevel = 40; // Reset to starting level
        this.noResponseCount = 0; // Reset no response counter
        this.waitingForResponse = false; // Reset response flag
        
        // Clear any pending timeouts
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
        
        if (this.currentFrequencyIndex >= this.testFrequencies.length) {
            // Finished current ear
            if (this.currentEar === 'right') {
                // Switch to left ear
                this.currentEar = 'left';
                this.currentFrequencyIndex = 0;
                
                this.showAlert('Great! Now we\'ll test your left ear.');
                setTimeout(() => this.startFrequencyTest(), 2000);
            } else {
                // Test complete
                this.completeTest();
            }
        } else {
            // Next frequency in same ear
            setTimeout(() => this.startFrequencyTest(), 1500);
        }
    }
    
    pauseTest() {
        this.isPaused = !this.isPaused;
        const button = document.getElementById('pause-btn');
        button.textContent = this.isPaused ? 'Resume Test' : 'Pause Test';
        
        if (this.isPaused) {
            // Stop any ongoing tone and clear timeouts
            this.waitingForResponse = false;
            if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
                this.responseTimeout = null;
            }
            if (this.currentToneTimeout) {
                clearTimeout(this.currentToneTimeout);
                this.currentToneTimeout = null;
            }
            if (this.oscillator) {
                try {
                    this.oscillator.stop();
                } catch (e) {
                    // Already stopped
                }
                this.oscillator = null;
            }
            this.isPlaying = false;
            document.getElementById('listening-indicator').style.display = 'none';
        } else {
            // Resume test
            const frequency = this.testFrequencies[this.currentFrequencyIndex];
            setTimeout(() => this.playTestTone(frequency), 500);
        }
    }
    
    repeatTone() {
        if (!this.isPaused && !this.waitingForResponse) {
            const frequency = this.testFrequencies[this.currentFrequencyIndex];
            this.playTestTone(frequency);
        }
    }
    
    // Results Methods
    completeTest() {
        this.showLoading('Analyzing results...');
        
        setTimeout(() => {
            this.hideLoading();
            this.analyzeResults();
            this.showScreen('results-screen');
        }, 3000);
    }
    
    analyzeResults() {
        // Calculate overall hearing status
        const rightThresholds = Object.values(this.testResults.right);
        const leftThresholds = Object.values(this.testResults.left);
        const allThresholds = [...rightThresholds, ...leftThresholds];
        
        const avgThreshold = allThresholds.reduce((sum, t) => sum + t, 0) / allThresholds.length;
        const maxThreshold = Math.max(...allThresholds);
        
        // Determine overall classification
        let overallClass = 'normal';
        let overallDescription = 'Normal hearing';
        let resultIcon = '✓';
        let iconClass = 'normal';
        
        if (maxThreshold > 90) {
            overallClass = 'profound';
            overallDescription = 'Profound hearing loss detected';
            resultIcon = '⚠️';
            iconClass = 'error';
        } else if (maxThreshold > 70) {
            overallClass = 'severe';
            overallDescription = 'Severe hearing loss detected';
            resultIcon = '⚠️';
            iconClass = 'error';
        } else if (maxThreshold > 55) {
            overallClass = 'moderately_severe';
            overallDescription = 'Moderately severe hearing loss detected';
            resultIcon = '⚠️';
            iconClass = 'warning';
        } else if (maxThreshold > 40) {
            overallClass = 'moderate';
            overallDescription = 'Moderate hearing loss detected';
            resultIcon = '⚠️';
            iconClass = 'warning';
        } else if (maxThreshold > 25) {
            overallClass = 'mild';
            overallDescription = 'Mild hearing loss detected';
            resultIcon = '⚠️';
            iconClass = 'warning';
        }
        
        // Update results UI
        document.getElementById('result-title').textContent = 
            this.hearingClassifications[overallClass].description;
        document.getElementById('result-description').textContent = overallDescription;
        document.getElementById('result-icon').textContent = resultIcon;
        document.getElementById('result-icon').className = 'result-icon ' + iconClass;
        
        // Generate audiogram
        this.generateAudiogram();
        
        // Generate detailed results
        this.generateDetailedResults();
        
        // Generate recommendations
        this.generateRecommendations(overallClass, maxThreshold);
    }
    
    generateAudiogram() {
        const canvas = document.getElementById('audiogram-chart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set up chart dimensions
        const margin = 40;
        const chartWidth = canvas.width - 2 * margin;
        const chartHeight = canvas.height - 2 * margin;
        
        // Draw axes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        
        // X-axis (frequency)
        ctx.beginPath();
        ctx.moveTo(margin, canvas.height - margin);
        ctx.lineTo(canvas.width - margin, canvas.height - margin);
        ctx.stroke();
        
        // Y-axis (hearing level)
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, canvas.height - margin);
        ctx.stroke();
        
        // Draw frequency labels
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        this.testFrequencies.forEach((freq, index) => {
            const x = margin + (index / (this.testFrequencies.length - 1)) * chartWidth;
            const label = freq >= 1000 ? (freq / 1000) + 'k' : freq.toString();
            ctx.fillText(label, x, canvas.height - margin + 20);
        });
        
        // Draw hearing level labels
        ctx.textAlign = 'right';
        const levels = [-10, 0, 20, 40, 60, 80, 100, 120];
        levels.forEach(level => {
            const y = margin + ((level + 10) / 130) * chartHeight;
            ctx.fillText(level.toString(), margin - 10, y + 4);
            
            // Draw grid lines
            ctx.strokeStyle = '#eee';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(canvas.width - margin, y);
            ctx.stroke();
        });
        
        // Plot thresholds
        this.plotEarThresholds(ctx, 'right', '#EF4444', 'O', margin, chartWidth, chartHeight);
        this.plotEarThresholds(ctx, 'left', '#3B82F6', 'X', margin, chartWidth, chartHeight);
    }
    
    plotEarThresholds(ctx, ear, color, symbol, margin, chartWidth, chartHeight) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        
        const thresholds = this.testResults[ear];
        const points = [];
        
        this.testFrequencies.forEach((freq, index) => {
            if (thresholds[freq] !== undefined) {
                const x = margin + (index / (this.testFrequencies.length - 1)) * chartWidth;
                const y = margin + ((thresholds[freq] + 10) / 130) * chartHeight;
                
                // Draw symbol
                ctx.fillText(symbol, x, y + 6);
                points.push({ x, y });
            }
        });
        
        // Connect points with lines
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }
    }
    
    generateDetailedResults() {
        // Right ear
        const rightClassification = this.classifyEar('right');
        const rightDiv = document.getElementById('right-ear-classification');
        rightDiv.innerHTML = `<span class="status status--${rightClassification.class}">${rightClassification.description}</span>`;
        
        const rightThresholds = document.getElementById('right-ear-thresholds');
        rightThresholds.innerHTML = '';
        this.testFrequencies.forEach(freq => {
            const threshold = this.testResults.right[freq];
            if (threshold !== undefined) {
                const item = document.createElement('div');
                item.className = 'threshold-item';
                item.innerHTML = `<span>${freq} Hz</span><span>${threshold} dB HL</span>`;
                rightThresholds.appendChild(item);
            }
        });
        
        // Left ear
        const leftClassification = this.classifyEar('left');
        const leftDiv = document.getElementById('left-ear-classification');
        leftDiv.innerHTML = `<span class="status status--${leftClassification.class}">${leftClassification.description}</span>`;
        
        const leftThresholds = document.getElementById('left-ear-thresholds');
        leftThresholds.innerHTML = '';
        this.testFrequencies.forEach(freq => {
            const threshold = this.testResults.left[freq];
            if (threshold !== undefined) {
                const item = document.createElement('div');
                item.className = 'threshold-item';
                item.innerHTML = `<span>${freq} Hz</span><span>${threshold} dB HL</span>`;
                leftThresholds.appendChild(item);
            }
        });
    }
    
    classifyEar(ear) {
        const thresholds = Object.values(this.testResults[ear]);
        const avgThreshold = thresholds.reduce((sum, t) => sum + t, 0) / thresholds.length;
        
        for (const [key, classification] of Object.entries(this.hearingClassifications)) {
            if (avgThreshold >= classification.range[0] && avgThreshold <= classification.range[1]) {
                return {
                    class: key === 'normal' ? 'success' : key === 'mild' ? 'warning' : 'error',
                    description: classification.description
                };
            }
        }
        
        return { class: 'error', description: 'Profound hearing loss' };
    }
    
    generateRecommendations(overallClass, maxThreshold) {
        const container = document.getElementById('recommendations-content');
        let recommendations = '';
        
        if (overallClass === 'normal') {
            recommendations = `
                <p><strong>✅ Normal Hearing Results</strong></p>
                <p>Your hearing test results are within normal limits. This means:</p>
                <ul>
                    <li>You can hear soft sounds at normal levels</li>
                    <li>No immediate hearing concerns detected</li>
                    <li>Continue to protect your hearing from loud noises</li>
                </ul>
                <p><strong>Next Steps:</strong></p>
                <ul>
                    <li>Schedule routine hearing checks annually</li>
                    <li>Use hearing protection in noisy environments</li>
                    <li>Contact a healthcare provider if you notice changes</li>
                </ul>
            `;
        } else if (maxThreshold > 40) {
            recommendations = `
                <p><strong>⚠️ Hearing Loss Detected</strong></p>
                <p>Your test results indicate hearing loss that may require attention:</p>
                <ul>
                    <li>Some sounds may be difficult to hear clearly</li>
                    <li>You may benefit from hearing aids or other treatments</li>
                    <li>Professional evaluation is recommended</li>
                </ul>
                <p><strong>Immediate Action Required:</strong></p>
                <ul>
                    <li>Schedule appointment with audiologist or ENT doctor</li>
                    <li>Avoid exposure to loud noises</li>
                    <li>Consider hearing protection devices</li>
                    <li>Inform family and friends about your hearing needs</li>
                </ul>
            `;
        } else {
            recommendations = `
                <p><strong>⚠️ Mild Hearing Changes</strong></p>
                <p>Your results show some mild changes in hearing:</p>
                <ul>
                    <li>Hearing is mostly normal with some minor concerns</li>
                    <li>You may occasionally miss soft sounds</li>
                    <li>Monitoring is recommended</li>
                </ul>
                <p><strong>Recommended Actions:</strong></p>
                <ul>
                    <li>Schedule follow-up hearing test in 6-12 months</li>
                    <li>Protect hearing from loud noise exposure</li>
                    <li>Consider professional evaluation if symptoms worsen</li>
                </ul>
            `;
        }
        
        container.innerHTML = recommendations;
    }
    
    // Export and Data Management
    exportResults() {
        const results = {
            patient: this.patientData,
            testDate: new Date().toISOString(),
            results: this.testResults,
            classification: this.getOverallClassification()
        };
        
        const dataStr = JSON.stringify(results, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `hearing-test-${this.patientData.name || 'anonymous'}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }
    
    shareResults() {
        if (navigator.share) {
            const shareData = {
                title: 'Hearing Test Results',
                text: `Hearing test completed for ${this.patientData.name || 'patient'}`,
                url: window.location.href
            };
            navigator.share(shareData);
        } else {
            // Fallback - copy to clipboard
            const resultsText = this.generateResultsText();
            navigator.clipboard.writeText(resultsText).then(() => {
                this.showAlert('Results copied to clipboard!');
            });
        }
    }
    
    generateResultsText() {
        let text = `Hearing Test Results\n`;
        text += `Date: ${new Date().toLocaleDateString()}\n`;
        text += `Patient: ${this.patientData.name || 'Anonymous'}\n`;
        text += `Age: ${this.patientData.age}\n\n`;
        
        text += `Right Ear Thresholds (dB HL):\n`;
        this.testFrequencies.forEach(freq => {
            if (this.testResults.right[freq] !== undefined) {
                text += `${freq} Hz: ${this.testResults.right[freq]} dB HL\n`;
            }
        });
        
        text += `\nLeft Ear Thresholds (dB HL):\n`;
        this.testFrequencies.forEach(freq => {
            if (this.testResults.left[freq] !== undefined) {
                text += `${freq} Hz: ${this.testResults.left[freq]} dB HL\n`;
            }
        });
        
        return text;
    }
    
    getOverallClassification() {
        const allThresholds = [
            ...Object.values(this.testResults.right),
            ...Object.values(this.testResults.left)
        ];
        const maxThreshold = Math.max(...allThresholds);
        
        for (const [key, classification] of Object.entries(this.hearingClassifications)) {
            if (maxThreshold >= classification.range[0] && maxThreshold <= classification.range[1]) {
                return key;
            }
        }
        return 'profound';
    }
    
    startNewTest() {
        if (confirm('Are you sure you want to start a new test? Current results will be lost.')) {
            location.reload();
        }
    }
    
    deleteData() {
        if (confirm('Are you sure you want to delete all test data? This cannot be undone.')) {
            this.patientData = { name: '', age: null, gender: '', id: '', hasHearingHistory: false, isAnonymous: false };
            this.testResults = { right: {}, left: {} };
            this.showAlert('All data has been deleted.');
            location.reload();
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.hearingApp = new HearingScreenApp();
    
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
});
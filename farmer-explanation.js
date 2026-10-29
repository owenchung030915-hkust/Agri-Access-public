class FarmerExplanationComponent {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.language = options.language || 'en'; // Default to English
        this.creditData = null;
        this.shapData = null;
        this.weatherData = null;
        this.satelliteData = null;
        
        if (!this.container) {
            console.error('Farmer explanation container not found:', containerId);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.container.className = 'farmer-explanation-panel';
        this.render().catch(error => {
            console.error('Error in init render:', error);
        });
    }
    
    setData(creditData, shapData, weatherData, satelliteData) {
        this.creditData = creditData;
        this.shapData = shapData;
        this.weatherData = weatherData;
        this.satelliteData = satelliteData;
        this.render().catch(error => {
            console.error('Error in setData render:', error);
        });
    }
    
    setLanguage(language) {
        this.language = language;
        this.render().catch(error => {
            console.error('Error in setLanguage render:', error);
        });
    }
    
    async generateExplanation() {
        if (!this.creditData) {
            console.warn(' No credit data available for explanation');
            return null;
        }

        console.log(' Credit data:', this.creditData);
        const translator = new LLMTranslationEngine();
        const farmContext = this.extractFarmContext();
        console.log(' Farm context:', farmContext);

        try {
            const explanation = await translator.translateCreditAnalysis(
                this.creditData,
                this.language,
                farmContext,
                this.shapData,
                this.weatherData,
                this.satelliteData
            );
            console.log(' Translator returned:', explanation);
            return this.normalizeExplanation(explanation, farmContext);
        } catch (error) {
            console.error(' Error generating explanation:', error);
            return this.normalizeExplanation(
                translator.generateRuleBasedExplanation(this.creditData, this.language, farmContext),
                farmContext
            );
        }
    }

    normalizeExplanation(explanation, farmContext) {
        const creditScore = this.extractCreditScore();
        const fallbackRecs = this.generateRecommendations(this.language, farmContext || this.extractFarmContext(), creditScore);
        if (!explanation || typeof explanation !== 'object') {
            return {
                summary: '',
                riskAssessment: this.getCreditDescription(creditScore, this.language),
                recommendations: fallbackRecs
            };
        }
        const recs = this.normalizeRecommendations(explanation.recommendations, fallbackRecs);
        return {
            summary: explanation.summary || '',
            riskAssessment: explanation.riskAssessment || explanation.credit_explanation || this.getCreditDescription(creditScore, this.language),
            recommendations: recs
        };
    }

    normalizeRecommendations(recs, fallbackRecs) {
        if (!Array.isArray(recs) || recs.length === 0) return fallbackRecs;
        return recs.map((rec, i) => {
            if (typeof rec === 'string') {
                return {
                    icon: '',
                    title: rec,
                    description: rec,
                    priority: i === 0 ? 'high' : 'medium',
                    priorityText: this.getPriorityText(i === 0 ? 'high' : 'medium'),
                    timeline: this.language === 'id' ? 'Segera' : 'Soon'
                };
            }
            const priority = rec.priority || 'medium';
            return {
                icon: rec.icon || '',
                title: rec.title || rec.name || (this.language === 'id' ? 'Saran' : 'Recommendation'),
                description: rec.description || rec.detail || rec.impact || '',
                priority,
                priorityText: rec.priorityText || this.getPriorityText(priority),
                timeline: rec.timeline || (this.language === 'id' ? 'Segera' : 'Soon')
            };
        });
    }
    
    extractFarmContext() {
        const farmSize = this.extractFarmSize();
        const location = this.extractLocation();
        const cropHealth = this.extractCropHealth();
        const cropEl = document.getElementById('primaryCrop');
        const nameEl = document.getElementById('farmerName');

        return {
            farmSize,
            location,
            cropHealth,
            crop: cropEl ? cropEl.value : '',
            farmerName: nameEl ? nameEl.value : '',
            hasWeatherData: !!this.weatherData,
            hasSatelliteData: !!this.satelliteData
        };
    }
    
    extractFarmSize() {
        const sizeEl = document.getElementById('farmSize');
        const hectares = sizeEl ? parseFloat(sizeEl.value) : NaN;
        if (Number.isFinite(hectares) && hectares > 0) {
            if (hectares < 1) return 'small';
            if (hectares < 5) return 'medium';
            return 'large';
        }

        if (this.shapData && this.shapData.features) {
            const sizeFeature = this.shapData.features.find(f =>
                f.feature_name && f.feature_name.includes('farm_size')
            );
            if (sizeFeature && sizeFeature.value > 0) {
                if (sizeFeature.value < 1) return 'small';
                if (sizeFeature.value < 5) return 'medium';
                return 'large';
            }
        }

        return 'medium';
    }
    
    extractLocation() {
        // Try to extract location from form or data
        const latElement = document.getElementById('latitude');
        const lonElement = document.getElementById('longitude');
        
        if (latElement && lonElement) {
            const lat = parseFloat(latElement.value);
            const lon = parseFloat(lonElement.value);
            
            // Determine region based on coordinates
            if (lat >= -6 && lat <= -5 && lon >= 106 && lon <= 107) return 'java';
            if (lat >= 3 && lat <= 6 && lon >= 95 && lon <= 140) return 'sumatra';
            if (lat >= -4 && lat <= 4 && lon >= 109 && lon <= 119) return 'kalimantan';
            return 'other';
        }
        
        return 'java'; // Default
    }
    
    extractCropHealth() {
        if (!this.satelliteData && !this.shapData) return 'unknown';
        
        // Look for vegetation index in SHAP features
        if (this.shapData && this.shapData.features) {
            const vegetationFeatures = this.shapData.features.filter(f =>f.feature_name && (
                    f.feature_name.includes('vegetation') || 
                    f.feature_name.includes('ndvi') ||
                    f.feature_name.includes('prithvi')
                )
            );
            
            if (vegetationFeatures.length >0) {
                const avgVegetation = vegetationFeatures.reduce((sum, f) =>sum + f.value, 0) / vegetationFeatures.length;
                
                if (avgVegetation >0.7) return 'excellent';
                if (avgVegetation >0.5) return 'good';
                if (avgVegetation >0.3) return 'fair';
                return 'poor';
            }
        }
        
        return 'good'; // Default assumption
    }
    
    getEmptyExplanation() {
        const messages = {
            id: {
                title: " Analisis Kredit Pertanian",
                subtitle: "Analisis sedang diproses...",
                waiting: "Menunggu data analisis kredit"
            },
            en: {
                title: " Agricultural Credit Analysis", 
                subtitle: "Analysis in progress...",
                waiting: "Waiting for credit analysis data"
            }
        };
        
        return messages[this.language] || messages.id;
    }
    
    async render() {
        if (!this.creditData) {
            const explanation = this.getEmptyExplanation();
            this.container.innerHTML = `
                <div class="farmer-explanation-header">
                    <h3>${explanation.title}</h3>
                    <p>${explanation.subtitle}</p>
                </div>
                <div class="farmer-explanation-content">
                    <div class="waiting-message">
                        <span class="loading-icon"></span>
                        <span>${explanation.waiting}</span>
                    </div>
                </div>
            `;
            return;
        }

        const renderToken = (this._renderToken = (this._renderToken || 0) + 1);
        this.showLoadingState();

        try {
            const explanation = await this.generateExplanation();
            if (renderToken !== this._renderToken) return;
            console.log(' Generated explanation:', explanation);
            this.renderFarmerInterface(explanation);
        } catch (error) {
            console.error(' Error rendering farmer explanation:', error);
            if (renderToken !== this._renderToken) return;
            // Still show local recommendations instead of a blank loader
            this.renderFarmerInterface(this.normalizeExplanation(null, this.extractFarmContext()));
        }
    }
    
    showLoadingState() {
        const content = this.generateFarmerContent(null);
        this.container.innerHTML = `
            <div class="farmer-explanation-header">
                <div class="header-main">
                    <h3>${content.title}</h3>
                    <div class="language-toggle">
                        <button class="lang-btn ${this.language === 'id' ? 'active' : ''}" 
                                onclick="farmerComponent.setLanguage('id')">ID</button>
                        <button class="lang-btn ${this.language === 'en' ? 'active' : ''}" 
                                onclick="farmerComponent.setLanguage('en')">EN</button>
                    </div>
                </div>
                <p class="header-subtitle">${content.subtitle}</p>
            </div>
            <div class="farmer-explanation-content">
                <div class="waiting-message">
                    <span class="loading-icon"></span>
                    <span>${this.language === 'id' ? 'Menganalisis data dengan AI...' : 'Analyzing data with AI...'}</span>
                </div>
            </div>
        `;
    }
    
    showErrorState() {
        this.container.innerHTML = `
            <div class="farmer-explanation-header">
                <h3>${this.language === 'id' ? ' Analisis Kredit Pertanian' : ' Agricultural Credit Analysis'}</h3>
                <p>${this.language === 'id' ? 'Terjadi kesalahan dalam analisis' : 'Error occurred during analysis'}</p>
            </div>
            <div class="farmer-explanation-content">
                <div class="error-message">
                    ${this.language === 'id' ? 
                        ' Tidak dapat memuat penjelasan. Silakan coba lagi.' : 
                        ' Unable to load explanation. Please try again.'}
                </div>
            </div>
        `;
    }
    
    renderFarmerInterface(explanation) {
        const content = this.generateFarmerContent(explanation);
        
        this.container.innerHTML = `
            <div class="farmer-explanation-header">
                <div class="header-main">
                    <h3> ${content.recommendationsTitle}</h3>
                    <div class="language-toggle">
                        <button class="lang-btn ${this.language === 'id' ? 'active' : ''}" 
                                onclick="farmerComponent.setLanguage('id')">ID</button>
                        <button class="lang-btn ${this.language === 'en' ? 'active' : ''}" 
                                onclick="farmerComponent.setLanguage('en')">EN</button>
                    </div>
                </div>
                <p class="header-subtitle">${this.language === 'id' ? 'Rekomendasi berdasarkan analisis data pertanian' : 'Recommendations based on agricultural data analysis'}</p>
            </div>
            
            <div class="farmer-explanation-content">
                <!-- Recommendations Only -->
                <div class="farmer-section recommendations">
                    <div class="recommendations-list">
                        ${content.recommendations.map(rec => `
                            <div class="recommendation-item">
                                <div class="rec-header">
                                    <span class="rec-icon">${rec.icon || ''}</span>
                                    <span class="rec-title">${rec.title}</span>
                                    <span class="rec-priority ${rec.priority}">${rec.priorityText || this.getPriorityText(rec.priority)}</span>
                                </div>
                                <div class="rec-description">${rec.description}</div>
                                <div class="rec-timeline">${rec.timeline}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    generateFarmerContent(explanation = null) {
        const farmContext = this.extractFarmContext();
        
        if (this.language === 'id') {
            return this.generateIndonesianContent(farmContext, explanation);
        } else {
            return this.generateEnglishContent(farmContext, explanation);
        }
    }
    
    farmSizeLabel(farmContext, language) {
        const size = farmContext.farmSize || 'medium';
        if (language === 'id') {
            if (size === 'small') return 'kebun kecil';
            if (size === 'large') return 'kebun besar';
            return 'kebun sedang';
        }
        if (size === 'small') return 'small';
        if (size === 'large') return 'large';
        return 'medium';
    }

    generateIndonesianContent(farmContext, explanation = null) {
        const creditScore = this.extractCreditScore();
        const sizeLabel = this.farmSizeLabel(farmContext, 'id');
        const crop = farmContext.crop ? ` (${farmContext.crop})` : '';
        const recs = (explanation && explanation.recommendations && explanation.recommendations.length)
            ? explanation.recommendations
            : this.generateRecommendations('id', farmContext, creditScore);

        return {
            title: "Analisis Kredit Pertanian",
            subtitle: `Berdasarkan analisis satelit ${sizeLabel} Anda${crop}`,
            creditIcon: this.getCreditIcon(creditScore),
            creditTitle: "Skor Kredit Anda",
            creditScore: this.formatCreditScore(creditScore),
            creditDescription: explanation?.riskAssessment || this.getCreditDescription(creditScore, 'id'),
            conditionsTitle: "Kondisi Saat Ini",
            conditions: this.generateConditions('id', farmContext),
            recommendationsTitle: "Saran Perbaikan",
            recommendations: recs
        };
    }
    
    generateEnglishContent(farmContext, explanation = null) {
        const creditScore = this.extractCreditScore();
        const sizeLabel = this.farmSizeLabel(farmContext, 'en');
        const crop = farmContext.crop ? ` (${farmContext.crop})` : '';
        const recs = (explanation && explanation.recommendations && explanation.recommendations.length)
            ? explanation.recommendations
            : this.generateRecommendations('en', farmContext, creditScore);

        return {
            title: "Agricultural Credit Analysis",
            subtitle: `Based on satellite analysis of your ${sizeLabel} farm${crop}`,
            creditIcon: this.getCreditIcon(creditScore),
            creditTitle: "Your Credit Score",
            creditScore: this.formatCreditScore(creditScore),
            creditDescription: explanation?.riskAssessment || this.getCreditDescription(creditScore, 'en'),
            conditionsTitle: "Current Conditions",
            conditions: this.generateConditions('en', farmContext),
            recommendationsTitle: "Improvement Recommendations",
            recommendations: recs
        };
    }
    
    extractCreditScore() {
        if (!this.creditData) return 650;
        const raw = this.creditData.credit_score ??
            this.creditData.score ??
            this.creditData.final_score ??
            650;
        const n = Number(raw);
        return Number.isFinite(n) ? Math.round(n) : 650;
    }
    
    extractRiskLevel() {
        if (!this.creditData) return 'medium';
        const rating = String(
            this.creditData.risk_level ||
            this.creditData.risk_rating ||
            ''
        ).toLowerCase();
        if (rating.includes('low') || rating.includes('excellent') || rating.includes('very good')) return 'low';
        if (rating.includes('high') || rating.includes('poor')) return 'high';
        return 'medium';
    }
    
    extractApprovalProbability() {
        if (!this.creditData) return 0;
        
        return this.creditData.approval_probability || 
               this.creditData.approval_rate || 
               0.5;
    }
    
    getCreditIcon(score) {
        if (score >= 750) return '';
        if (score >= 650) return '';
        return '';
    }
    
    formatCreditScore(score) {
        // Convert to SLIK rating (1-5 scale)
        let slikRating;
        if (score >= 800) slikRating = 1;
        else if (score >= 750) slikRating = 2;
        else if (score >= 650) slikRating = 3;
        else if (score >= 550) slikRating = 4;
        else slikRating = 5;
        
        return `${score} (SLIK ${slikRating})`;
    }
    
    getCreditDescription(score, language) {
        const descriptions = {
            id: {
                excellent: "Kredit sangat baik - cocok untuk bunga rendah 6-7%",
                good: "Kredit baik - layak untuk bunga standar 8-10%", 
                fair: "Kredit cukup - memerlukan perbaikan untuk bunga lebih baik",
                poor: "Kredit lemah - fokus pada perbaikan sebelum mengajukan"
            },
            en: {
                excellent: "Excellent credit - eligible for low interest rates 6-7%",
                good: "Good credit - qualified for standard rates 8-10%",
                fair: "Fair credit - improvements needed for better rates",
                poor: "Poor credit - focus on improvements before applying"
            }
        };
        
        let category;
        if (score >= 750) category = 'excellent';
        else if (score >= 650) category = 'good';
        else if (score >= 550) category = 'fair';
        else category = 'poor';
        
        return descriptions[language][category];
    }
    
    generateConditions(language, farmContext) {
        console.log(' generateConditions called with:', { language, farmContext });
        const conditions = [];
        
        // Crop health condition
        const cropHealthTexts = {
            id: {
                excellent: { text: "Tanaman sangat sehat", icon: "", status: "" },
                good: { text: "Tanaman sehat", icon: "", status: "" },
                fair: { text: "Tanaman perlu perhatian", icon: "", status: "" },
                poor: { text: "Tanaman butuh perbaikan", icon: "", status: "" },
                unknown: { text: "Kondisi tanaman belum dianalisis", icon: "", status: "" }
            },
            en: {
                excellent: { text: "Crops very healthy", icon: "", status: "" },
                good: { text: "Crops healthy", icon: "", status: "" },
                fair: { text: "Crops need attention", icon: "", status: "" },
                poor: { text: "Crops need improvement", icon: "", status: "" },
                unknown: { text: "Crop condition not yet analyzed", icon: "", status: "" }
            }
        };
        
        const cropHealthCondition = (cropHealthTexts[language] && cropHealthTexts[language][farmContext.cropHealth]) || 
                                    (cropHealthTexts[language] && cropHealthTexts[language].unknown) || 
                                    cropHealthTexts.en.unknown;
        console.log(' Crop health condition:', cropHealthCondition);
        conditions.push(cropHealthCondition);
        
        // Weather condition
        if (farmContext.hasWeatherData) {
            const weatherTexts = {
                id: { text: "Cuaca mendukung", icon: "", status: "" },
                en: { text: "Weather favorable", icon: "", status: "" }
            };
            const weatherCondition = weatherTexts[language] || weatherTexts.en;
            conditions.push(weatherCondition);
        }
        
        // Farm size condition
        const sizeTexts = {
            id: {
                small: { text: "Kebun skala kecil", icon: "", status: "" },
                medium: { text: "Kebun skala menengah", icon: "", status: "" },
                large: { text: "Kebun skala besar", icon: "", status: "" },
                unknown: { text: "Ukuran kebun belum dianalisis", icon: "", status: "" }
            },
            en: {
                small: { text: "Small scale farm", icon: "", status: "" },
                medium: { text: "Medium scale farm", icon: "", status: "" },
                large: { text: "Large scale farm", icon: "", status: "" },
                unknown: { text: "Farm size not yet analyzed", icon: "", status: "" }
            }
        };
        
        const farmSizeCondition = sizeTexts[language] && sizeTexts[language][farmContext.farmSize] || 
                                 sizeTexts[language] && sizeTexts[language].unknown || 
                                 sizeTexts.en.unknown;
        console.log(' Farm size condition:', farmSizeCondition);
        conditions.push(farmSizeCondition);
        
        console.log(' Final conditions array:', conditions);
        
        // Validate all conditions have required properties
        const validatedConditions = conditions.map((condition, index) => {
            if (!condition || typeof condition !== 'object') {
                console.error(` Invalid condition at index ${index}:`, condition);
                return { text: 'Unknown condition', icon: '', status: '' };
            }
            if (!condition.text || !condition.icon || !condition.status) {
                console.error(` Missing properties in condition at index ${index}:`, condition);
                return { 
                    text: condition.text || 'Unknown', 
                    icon: condition.icon || '', 
                    status: condition.status || '' 
                };
            }
            return condition;
        });
        
        console.log(' Validated conditions:', validatedConditions);
        return validatedConditions;
    }
    
    generateRecommendations(language, farmContext, creditScore) {
        const recommendations = [];
        
        // Priority recommendations based on credit score and farm conditions
        if (creditScore < 650) {
            // High priority - credit improvement
            if (language === 'id') {
                recommendations.push({
                    icon: "",
                    title: "Perbaiki Catatan Keuangan",
                    description: "Catat semua pemasukan dan pengeluaran pertanian dengan detail",
                    priority: "high",
                    priorityText: "Prioritas Tinggi",
                    timeline: "0-30 hari"
                });
            } else {
                recommendations.push({
                    icon: "", 
                    title: "Improve Financial Records",
                    description: "Keep detailed records of all farm income and expenses",
                    priority: "high",
                    priorityText: "High Priority", 
                    timeline: "0-30 days"
                });
            }
        }
        
        if (farmContext.cropHealth === 'fair' || farmContext.cropHealth === 'poor') {
            // Medium priority - crop improvement
            if (language === 'id') {
                recommendations.push({
                    icon: "",
                    title: "Tingkatkan Kesehatan Tanaman",
                    description: "Gunakan pupuk organik dan sistem irigasi yang lebih baik",
                    priority: "medium",
                    priorityText: "Prioritas Sedang",
                    timeline: "1-3 bulan"
                });
            } else {
                recommendations.push({
                    icon: "",
                    title: "Improve Crop Health", 
                    description: "Use organic fertilizers and better irrigation systems",
                    priority: "medium",
                    priorityText: "Medium Priority",
                    timeline: "1-3 months"
                });
            }
        }
        
        if (farmContext.farmSize === 'small') {
            // Long-term recommendation - expansion
            if (language === 'id') {
                recommendations.push({
                    icon: "",
                    title: "Pertimbangkan Diversifikasi",
                    description: "Tanam varietas tanaman yang berbeda untuk mengurangi risiko",
                    priority: "low",
                    priorityText: "Jangka Panjang",
                    timeline: "6-12 bulan"
                });
            } else {
                recommendations.push({
                    icon: "",
                    title: "Consider Diversification",
                    description: "Plant different crop varieties to reduce risk",
                    priority: "low", 
                    priorityText: "Long Term",
                    timeline: "6-12 months"
                });
            }
        }
        
        // Always include financial planning recommendation
        if (language === 'id') {
            recommendations.push({
                icon: "",
                title: "Rencanakan Keuangan Musiman",
                description: "Siapkan dana untuk masa tanam dan panen berikutnya",
                priority: "medium",
                priorityText: "Prioritas Sedang", 
                timeline: "Berkelanjutan"
            });
        } else {
            recommendations.push({
                icon: "",
                title: "Plan Seasonal Finances",
                description: "Prepare funds for next planting and harvest cycles",
                priority: "medium",
                priorityText: "Medium Priority",
                timeline: "Ongoing"
            });
        }
        
        return recommendations;
    }
    
    getPriorityText(priority) {
        const texts = {
            id: {
                high: 'Prioritas Tinggi',
                medium: 'Prioritas Sedang',
                low: 'Jangka Panjang'
            },
            en: {
                high: 'High Priority',
                medium: 'Medium Priority',
                low: 'Long Term'
            }
        };
        
        return texts[this.language][priority] || priority;
    }
}

class LLMTranslationEngine {
    constructor() {
        this.cache = new Map();
        this.apiEndpoint = (typeof window.agriApiUrl === 'function')
            ? window.agriApiUrl('/api/farmer/explain')
            : '/api/farmer/explain';
    }
    
    async translateCreditAnalysis(technicalData, targetLanguage, farmContext, shapData = null, weatherData = null, satelliteData = null) {
        const cacheKey = `credit_${JSON.stringify(technicalData)}_${targetLanguage}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            // Try to get AI-powered explanation from Gemini API
            const translation = await this.getGeminiExplanation(technicalData, targetLanguage, farmContext, shapData, weatherData, satelliteData);
            this.cache.set(cacheKey, translation);
            return translation;
        } catch (error) {
            console.warn(' Gemini API unavailable, using fallback:', error);
            // Fallback to rule-based explanation
            const fallback = this.generateRuleBasedExplanation(technicalData, targetLanguage, farmContext);
            return fallback;
        }
    }
    
    async getGeminiExplanation(technicalData, targetLanguage, farmContext, shapData = null, weatherData = null, satelliteData = null) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 22000) : null;
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: (typeof window.agriAuthHeaders === 'function')
                    ? window.agriAuthHeaders()
                    : { 'Content-Type': 'application/json' },
                credentials: 'include',
                signal: controller ? controller.signal : undefined,
                body: JSON.stringify({
                    creditData: technicalData,
                    shapData: shapData,
                    weatherData: weatherData,
                    satelliteData: satelliteData,
                    language: targetLanguage,
                    farmContext: farmContext
                })
            });

            const result = await response.json().catch(() => ({}));

            // Prefer explanation even on non-2xx if the API attached fallback content
            if (result.explanation) {
                return this.formatGeminiResponse(result.explanation, targetLanguage);
            }
            if (result.fallback) {
                return this.formatGeminiResponse(result.fallback, targetLanguage);
            }
            if (!response.ok) {
                throw new Error(result.error || `API request failed: ${response.status}`);
            }
            throw new Error(result.error || 'API request failed');
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
    
    formatGeminiResponse(explanation, language) {
        // Format the Gemini response to match the expected structure
        return {
            summary: explanation.summary || '',
            riskAssessment: explanation.credit_explanation || '',
            recommendations: explanation.recommendations || []
        };
    }
    
    translateSHAPValues(shapData, targetLanguage, farmContext) {
        if (!shapData || !shapData.features) return [];
        
        return shapData.features.map(feature => {
            const translatedName = this.translateFeatureName(feature.feature_name, targetLanguage);
            const impact = this.interpretFeatureImpact(feature.value, targetLanguage);
            
            return {
                originalName: feature.feature_name,
                translatedName,
                value: feature.value,
                impact,
                advice: this.generateFeatureAdvice(feature, targetLanguage, farmContext)
            };
        });
    }
    
    translateFeatureName(featureName, language) {
        const translations = {
            id: {
                'prithvi_vegetation': 'Kesehatan Tanaman dari Satelit',
                'weather_temperature': 'Suhu Udara untuk Tanaman',
                'farm_size': 'Ukuran Kebun',
                'soil_quality': 'Kesuburan Tanah',
                'water_access': 'Akses Air untuk Irigasi',
                'precipitation': 'Curah Hujan',
                'humidity': 'Kelembaban Udara'
            },
            en: {
                'prithvi_vegetation': 'Crop Health from Satellite',
                'weather_temperature': 'Air Temperature for Crops',
                'farm_size': 'Farm Size',
                'soil_quality': 'Soil Fertility',
                'water_access': 'Water Access for Irrigation',
                'precipitation': 'Rainfall',
                'humidity': 'Air Humidity'
            }
        };
        
        // Try to find a matching translation
        for (const [key, translation] of Object.entries(translations[language] || {})) {
            if (featureName.includes(key)) {
                return translation;
            }
        }
        
        // Fallback to a cleaned version of the original name
        return featureName.replace(/_/g, ' ').replace(/\b\w/g, l =>l.toUpperCase());
    }
    
    interpretFeatureImpact(value, language) {
        const impacts = {
            id: {
                positive: "Membantu skor kredit Anda",
                negative: "Perlu diperbaiki untuk kredit lebih baik",
                neutral: "Tidak berdampak signifikan"
            },
            en: {
                positive: "Helps your credit score",
                negative: "Needs improvement for better credit",
                neutral: "No significant impact"
            }
        };
        
        if (value >0.1) return impacts[language].positive;
        if (value < -0.1) return impacts[language].negative;
        return impacts[language].neutral;
    }
    
    generateFeatureAdvice(feature, language, farmContext) {
        // Generate specific advice based on feature type and impact
        if (feature.value < -0.1) {
            // Negative impact - provide improvement advice
            if (feature.feature_name.includes('vegetation')) {
                return language === 'id' ? 
                    'Gunakan pupuk organik dan pastikan irigasi yang cukup' :
                    'Use organic fertilizer and ensure adequate irrigation';
            }
            if (feature.feature_name.includes('temperature')) {
                return language === 'id' ?
                    'Pertimbangkan tanaman yang tahan terhadap suhu ekstrem' :
                    'Consider crops that are resistant to extreme temperatures';
            }
        }
        
        return language === 'id' ? 
            'Pertahankan kondisi saat ini' :
            'Maintain current conditions';
    }
    
    generateRuleBasedExplanation(technicalData, targetLanguage, farmContext) {
        // Simple rule-based explanation generation
        // In production, this would integrate with a real LLM API
        
        return {
            summary: this.generateSummary(technicalData, targetLanguage, farmContext),
            riskAssessment: this.generateRiskAssessment(technicalData, targetLanguage),
            recommendations: this.generateBasicRecommendations(technicalData, targetLanguage, farmContext)
        };
    }
    
    generateSummary(technicalData, language, farmContext) {
        const creditScore = technicalData.credit_score || 650;
        
        if (language === 'id') {
            return `Berdasarkan analisis satelit dan cuaca, skor kredit Anda adalah ${creditScore}. ` +
                   `Kondisi ${farmContext.farmSize === 'small' ? 'kebun kecil' : 'kebun'} Anda ` +
                   `${farmContext.cropHealth === 'good' ? 'menunjukkan potensi baik' : 'memerlukan perhatian'} ` +
                   `untuk pengajuan kredit pertanian.`;
        } else {
            return `Based on satellite and weather analysis, your credit score is ${creditScore}. ` +
                   `Your ${farmContext.farmSize} farm shows ` +
                   `${farmContext.cropHealth === 'good' ? 'good potential' : 'areas needing attention'} ` +
                   `for agricultural credit application.`;
        }
    }
    
    generateRiskAssessment(technicalData, language) {
        const riskLevel = technicalData.risk_level || 'medium';
        
        if (language === 'id') {
            const riskTexts = {
                low: 'Risiko rendah - cocok untuk bunga kompetitif',
                medium: 'Risiko sedang - layak untuk bunga standar',
                high: 'Risiko tinggi - memerlukan perbaikan sebelum pengajuan'
            };
            return riskTexts[riskLevel];
        } else {
            const riskTexts = {
                low: 'Low risk - eligible for competitive interest rates',
                medium: 'Medium risk - qualified for standard rates', 
                high: 'High risk - improvements needed before application'
            };
            return riskTexts[riskLevel];
        }
    }
    
    generateBasicRecommendations(technicalData, language, farmContext) {
        if (language === 'id') {
            const recommendations = [
                {
                    title: 'Perbaiki Catatan Keuangan',
                    description: 'Catat semua pemasukan dan pengeluaran pertanian secara rapi',
                    priority: 'high',
                    timeline: '1-30 hari',
                    impact: 'Meningkatkan kepercayaan bank'
                }
            ];
            if (farmContext.cropHealth !== 'excellent') {
                recommendations.push({
                    title: 'Tingkatkan Kesehatan Tanaman',
                    description: 'Gunakan pupuk organik dan pastikan irigasi cukup',
                    priority: 'medium',
                    timeline: '1-3 bulan',
                    impact: 'Meningkatkan hasil panen'
                });
            }
            recommendations.push({
                title: 'Diversifikasi Tanaman',
                description: 'Tanam lebih dari satu jenis komoditas untuk mengurangi risiko',
                priority: 'low',
                timeline: '6-12 bulan',
                impact: 'Stabilkan arus kas'
            });
            return recommendations;
        }

        const recommendations = [
            {
                title: 'Improve Financial Records',
                description: 'Keep clear records of farm income and expenses',
                priority: 'high',
                timeline: '1-30 days',
                impact: 'Increases lender confidence'
            }
        ];
        if (farmContext.cropHealth !== 'excellent') {
            recommendations.push({
                title: 'Improve Crop Health',
                description: 'Use organic fertilizer and ensure adequate irrigation',
                priority: 'medium',
                timeline: '1-3 months',
                impact: 'Better harvest yields'
            });
        }
        recommendations.push({
            title: 'Diversify Crops',
            description: 'Grow more than one commodity to reduce risk',
            priority: 'low',
            timeline: '6-12 months',
            impact: 'More stable cash flow'
        });
        return recommendations;
    }
}

// Expose the class to the global window object
window.FarmerExplanationComponent = FarmerExplanationComponent;
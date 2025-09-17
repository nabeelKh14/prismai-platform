import { Translate } from '@google-cloud/translate/build/src/v2'

export interface TranslationResult {
  translatedText: string
  detectedLanguage?: string
  confidence?: number
}

export interface LanguageDetectionResult {
  language: string
  confidence: number
}

export class LanguageClient {
  private translate: Translate

  constructor(projectId: string, keyFilename?: string) {
    this.translate = new Translate({
      projectId,
      keyFilename
    })
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult | null> {
    try {
      const [detections] = await this.translate.detect(text)

      if (detections && detections.length > 0) {
        const detection = detections[0]
        return {
          language: detection.language,
          confidence: detection.confidence || 0
        }
      }

      return null
    } catch (error) {
      console.error('Error detecting language:', error)
      return null
    }
  }

  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult | null> {
    try {
      const [translation] = await this.translate.translate(text, {
        from: sourceLanguage,
        to: targetLanguage
      })

      return {
        translatedText: translation,
        detectedLanguage: sourceLanguage
      }
    } catch (error) {
      console.error('Error translating text:', error)
      return null
    }
  }

  async translateToMultipleLanguages(text: string, targetLanguages: string[], sourceLanguage?: string): Promise<Record<string, TranslationResult>> {
    const results: Record<string, TranslationResult> = {}

    for (const lang of targetLanguages) {
      const translation = await this.translateText(text, lang, sourceLanguage)
      if (translation) {
        results[lang] = translation
      }
    }

    return results
  }

  getSupportedLanguages(): string[] {
    // Common supported languages - in production, you might want to fetch this dynamically
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
      'bn', 'pa', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'or', 'as', 'mai', 'ml',
      'th', 'vi', 'id', 'ms', 'tl', 'sw', 'am', 'ha', 'yo', 'ig', 'zu', 'xh'
    ]
  }

  isLanguageSupported(languageCode: string): boolean {
    return this.getSupportedLanguages().includes(languageCode)
  }
}
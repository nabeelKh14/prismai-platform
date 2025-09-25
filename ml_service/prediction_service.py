"""
ML Prediction Service
Handles making predictions using trained ML models
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from model_training import ModelTrainer
from preprocessing import DataPreprocessor, create_lead_features
import logging

logger = logging.getLogger(__name__)

class PredictionService:
    """Service for making predictions using trained ML models"""

    def __init__(self, model_dir: str = 'models'):
        self.model_trainer = ModelTrainer(model_dir)
        self.preprocessor = DataPreprocessor()

    def predict_lead_conversion(self, lead_data: Dict[str, Any], user_id: str,
                              model_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Predict lead conversion probability

        Args:
            lead_data: Lead data dictionary
            user_id: User ID
            model_name: Specific model to use (optional)

        Returns:
            Prediction results with probability and confidence
        """
        try:
            # Get the best model for lead conversion
            model_path = self._get_best_model_path(user_id, 'lead_conversion', model_name)

            if not model_path:
                return {
                    'success': False,
                    'error': 'No trained model available for lead conversion'
                }

            # Prepare features
            features_df = self._prepare_lead_features([lead_data])

            # Make prediction
            model, metadata = self.model_trainer.load_model(model_path)
            prediction_proba = model.predict_proba(features_df)

            # Get prediction probability for positive class (conversion)
            conversion_probability = prediction_proba[0][1] if len(prediction_proba[0]) > 1 else prediction_proba[0][0]

            # Calculate confidence based on prediction strength
            confidence = self._calculate_prediction_confidence(conversion_probability, prediction_proba)

            # Get feature importance for explanation
            feature_importance = self._get_prediction_explanation(model, features_df, metadata)

            result = {
                'success': True,
                'prediction_type': 'lead_conversion',
                'conversion_probability': float(conversion_probability),
                'confidence': float(confidence),
                'prediction_class': 'high' if conversion_probability > 0.7 else 'medium' if conversion_probability > 0.4 else 'low',
                'feature_importance': feature_importance,
                'model_info': {
                    'model_path': model_path,
                    'algorithm': metadata.get('algorithm'),
                    'training_date': metadata.get('training_date')
                }
            }

            logger.info(f"Lead conversion prediction: {conversion_probability:.3f} (confidence: {confidence:.3f})")
            return result

        except Exception as e:
            logger.error(f"Error in lead conversion prediction: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def predict_customer_lifetime_value(self, customer_data: Dict[str, Any], user_id: str,
                                      model_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Predict customer lifetime value

        Args:
            customer_data: Customer data dictionary
            user_id: User ID
            model_name: Specific model to use (optional)

        Returns:
            Prediction results with lifetime value estimate
        """
        try:
            # Get the best model for lifetime value prediction
            model_path = self._get_best_model_path(user_id, 'customer_lifetime_value', model_name)

            if not model_path:
                return {
                    'success': False,
                    'error': 'No trained model available for lifetime value prediction'
                }

            # Prepare features
            features_df = self._prepare_customer_features([customer_data])

            # Make prediction
            model, metadata = self.model_trainer.load_model(model_path)
            prediction = model.predict(features_df)[0]

            # Ensure prediction is positive
            lifetime_value = max(0, prediction)

            # Calculate confidence based on prediction variance
            confidence = self._calculate_regression_confidence(model, features_df, lifetime_value)

            # Get feature importance for explanation
            feature_importance = self._get_prediction_explanation(model, features_df, metadata)

            result = {
                'success': True,
                'prediction_type': 'customer_lifetime_value',
                'lifetime_value': float(lifetime_value),
                'confidence': float(confidence),
                'value_category': self._categorize_lifetime_value(lifetime_value),
                'feature_importance': feature_importance,
                'model_info': {
                    'model_path': model_path,
                    'algorithm': metadata.get('algorithm'),
                    'training_date': metadata.get('training_date')
                }
            }

            logger.info(f"LTV prediction: ${lifetime_value:.2f} (confidence: {confidence:.3f})")
            return result

        except Exception as e:
            logger.error(f"Error in LTV prediction: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def batch_predict_lead_conversion(self, leads_data: List[Dict[str, Any]], user_id: str,
                                    model_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Make batch predictions for multiple leads

        Args:
            leads_data: List of lead data dictionaries
            user_id: User ID
            model_name: Specific model to use (optional)

        Returns:
            Batch prediction results
        """
        try:
            model_path = self._get_best_model_path(user_id, 'lead_conversion', model_name)

            if not model_path:
                return {
                    'success': False,
                    'error': 'No trained model available for lead conversion'
                }

            # Prepare features
            features_df = self._prepare_lead_features(leads_data)

            # Make predictions
            model, metadata = self.model_trainer.load_model(model_path)
            predictions_proba = model.predict_proba(features_df)

            # Process results
            results = []
            for i, lead_data in enumerate(leads_data):
                conversion_probability = predictions_proba[i][1] if len(predictions_proba[i]) > 1 else predictions_proba[i][0]
                confidence = self._calculate_prediction_confidence(conversion_probability, predictions_proba[i])

                results.append({
                    'lead_id': lead_data.get('id', f'lead_{i}'),
                    'conversion_probability': float(conversion_probability),
                    'confidence': float(confidence),
                    'prediction_class': 'high' if conversion_probability > 0.7 else 'medium' if conversion_probability > 0.4 else 'low'
                })

            return {
                'success': True,
                'total_predictions': len(results),
                'predictions': results,
                'model_info': {
                    'model_path': model_path,
                    'algorithm': metadata.get('algorithm')
                }
            }

        except Exception as e:
            logger.error(f"Error in batch lead conversion prediction: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_best_model_path(self, user_id: str, model_type: str, model_name: Optional[str] = None) -> Optional[str]:
        """Get the best available model for the given type"""
        models = self.model_trainer.get_model_list(user_id)

        # Filter by model type
        type_models = [m for m in models if m['metadata'].get('model_type') == model_type]

        if not type_models:
            return None

        # If specific model name requested
        if model_name:
            for model in type_models:
                if model['metadata'].get('model_name') == model_name:
                    return model['model_path']

        # Return the most recently trained model
        best_model = max(type_models, key=lambda x: x['metadata']['training_date'])
        return best_model['model_path']

    def _prepare_lead_features(self, leads_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Prepare lead data for prediction"""
        # Create base features
        features_df = create_lead_features(leads_data)

        # Add any additional preprocessing if needed
        # This could include loading saved preprocessing configurations

        return features_df

    def _prepare_customer_features(self, customers_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Prepare customer data for lifetime value prediction"""
        # Create base features from customer data
        features_df = pd.DataFrame(customers_data)

        # Add customer-specific features
        if 'first_purchase_date' in features_df.columns:
            features_df['days_since_first_purchase'] = (pd.Timestamp.now() - pd.to_datetime(features_df['first_purchase_date'])).dt.days

        if 'total_orders' in features_df.columns and 'total_spent' in features_df.columns:
            features_df['avg_order_value'] = features_df['total_spent'] / features_df['total_orders']

        # Fill missing values
        numeric_columns = features_df.select_dtypes(include=[np.number]).columns
        features_df[numeric_columns] = features_df[numeric_columns].fillna(features_df[numeric_columns].mean())

        return features_df

    def _calculate_prediction_confidence(self, probability: float, probabilities: np.ndarray) -> float:
        """Calculate confidence score for classification prediction"""
        # Confidence based on how far the prediction is from 0.5
        distance_from_threshold = abs(probability - 0.5)
        confidence = min(distance_from_threshold * 2, 1.0)

        # Also consider the maximum probability
        max_prob = np.max(probabilities)
        confidence = (confidence + max_prob) / 2

        return confidence

    def _calculate_regression_confidence(self, model: Any, features: pd.DataFrame, prediction: float) -> float:
        """Calculate confidence score for regression prediction"""
        try:
            # Use prediction variance if available
            if hasattr(model, 'predict'):
                # Simple confidence based on feature importance and prediction magnitude
                return min(abs(prediction) / 1000, 0.9) + 0.1
        except:
            pass

        return 0.7  # Default confidence

    def _categorize_lifetime_value(self, value: float) -> str:
        """Categorize lifetime value into segments"""
        if value > 10000:
            return 'high_value'
        elif value > 1000:
            return 'medium_value'
        elif value > 100:
            return 'low_value'
        else:
            return 'very_low_value'

    def _get_prediction_explanation(self, model: Any, features: pd.DataFrame, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Get explanation for prediction based on feature importance"""
        try:
            feature_names = metadata.get('features', features.columns.tolist())
            feature_importance = metadata.get('feature_importance', {})

            # Get top contributing features
            top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]

            explanation = {
                'top_features': top_features,
                'feature_count': len(feature_importance),
                'explanation_method': 'feature_importance'
            }

            return explanation

        except Exception as e:
            logger.warning(f"Could not generate prediction explanation: {e}")
            return {
                'error': 'Explanation not available',
                'explanation_method': 'none'
            }

    def get_prediction_insights(self, user_id: str, model_type: str) -> Dict[str, Any]:
        """Get insights about prediction patterns and model performance"""
        try:
            models = self.model_trainer.get_model_list(user_id)
            type_models = [m for m in models if m['metadata'].get('model_type') == model_type]

            if not type_models:
                return {'error': 'No models available for insights'}

            # Aggregate insights from all models
            insights = {
                'total_models': len(type_models),
                'model_types': list(set(m['metadata'].get('algorithm') for m in type_models)),
                'avg_performance': {},
                'feature_importance_trends': {},
                'prediction_patterns': {}
            }

            # Calculate average performance across models
            performance_metrics = ['accuracy', 'precision', 'recall', 'f1_score', 'r2_score']
            for metric in performance_metrics:
                values = [m['metadata']['metrics'].get(metric, 0) for m in type_models if metric in m['metadata']['metrics']]
                if values:
                    insights['avg_performance'][metric] = {
                        'mean': np.mean(values),
                        'std': np.std(values),
                        'min': np.min(values),
                        'max': np.max(values)
                    }

            return insights

        except Exception as e:
            logger.error(f"Error generating prediction insights: {e}")
            return {'error': str(e)}
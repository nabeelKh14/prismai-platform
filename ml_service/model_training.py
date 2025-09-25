"""
ML Model Training Service
Handles training, evaluation, and persistence of ML models
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_squared_error, mean_absolute_error, r2_score,
    roc_auc_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import StandardScaler
import logging

logger = logging.getLogger(__name__)

class ModelTrainer:
    """Handles training and evaluation of ML models"""

    def __init__(self, model_dir: str = 'models'):
        self.model_dir = model_dir
        self.models = {}
        self.model_configs = {
            'lead_conversion': {
                'algorithms': {
                    'random_forest': {
                        'model': RandomForestClassifier,
                        'params': {
                            'n_estimators': [100, 200, 300],
                            'max_depth': [10, 20, 30, None],
                            'min_samples_split': [2, 5, 10],
                            'min_samples_leaf': [1, 2, 4]
                        }
                    },
                    'gradient_boosting': {
                        'model': GradientBoostingClassifier,
                        'params': {
                            'n_estimators': [100, 200],
                            'learning_rate': [0.05, 0.1, 0.2],
                            'max_depth': [3, 5, 7]
                        }
                    },
                    'logistic_regression': {
                        'model': LogisticRegression,
                        'params': {
                            'C': [0.1, 1, 10, 100],
                            'max_iter': [1000]
                        }
                    },
                    'neural_network': {
                        'model': MLPClassifier,
                        'params': {
                            'hidden_layer_sizes': [(50, 25), (100, 50), (100, 50, 25)],
                            'activation': ['relu', 'tanh'],
                            'learning_rate': ['constant', 'adaptive'],
                            'max_iter': [500]
                        }
                    }
                }
            },
            'customer_lifetime_value': {
                'algorithms': {
                    'random_forest': {
                        'model': RandomForestRegressor,
                        'params': {
                            'n_estimators': [100, 200, 300],
                            'max_depth': [10, 20, 30, None],
                            'min_samples_split': [2, 5, 10],
                            'min_samples_leaf': [1, 2, 4]
                        }
                    },
                    'gradient_boosting': {
                        'model': GradientBoostingRegressor,
                        'params': {
                            'n_estimators': [100, 200],
                            'learning_rate': [0.05, 0.1, 0.2],
                            'max_depth': [3, 5, 7]
                        }
                    },
                    'linear_regression': {
                        'model': LinearRegression,
                        'params': {}
                    },
                    'neural_network': {
                        'model': MLPRegressor,
                        'params': {
                            'hidden_layer_sizes': [(50, 25), (100, 50), (100, 50, 25)],
                            'activation': ['relu', 'tanh'],
                            'learning_rate': ['constant', 'adaptive'],
                            'max_iter': [500]
                        }
                    }
                }
            }
        }

        # Create model directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)

    def train_model(self, model_type: str, algorithm: str, X: pd.DataFrame, y: pd.Series,
                   model_name: str, user_id: str, **kwargs) -> Dict[str, Any]:
        """
        Train a model with the specified configuration

        Args:
            model_type: Type of model ('lead_conversion', 'customer_lifetime_value')
            algorithm: Algorithm to use
            X: Feature matrix
            y: Target variable
            model_name: Name for the model
            user_id: User ID for model tracking
            **kwargs: Additional training parameters

        Returns:
            Dictionary with training results and model metadata
        """
        logger.info(f"Training {algorithm} model for {model_type}")

        if model_type not in self.model_configs:
            raise ValueError(f"Unknown model type: {model_type}")

        if algorithm not in self.model_configs[model_type]['algorithms']:
            raise ValueError(f"Unknown algorithm {algorithm} for model type {model_type}")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if model_type == 'lead_conversion' else None
        )

        # Get model configuration
        model_config = self.model_configs[model_type]['algorithms'][algorithm]
        ModelClass = model_config['model']

        # Create base model
        model = ModelClass(random_state=42)

        # Hyperparameter tuning if parameters are specified
        if model_config['params']:
            logger.info(f"Performing hyperparameter tuning for {algorithm}")
            grid_search = GridSearchCV(
                model, model_config['params'], cv=5, scoring='accuracy' if model_type == 'lead_conversion' else 'r2',
                n_jobs=-1, verbose=1
            )
            grid_search.fit(X_train, y_train)
            model = grid_search.best_estimator_
            best_params = grid_search.best_params_
        else:
            model.fit(X_train, y_train)
            best_params = {}

        # Make predictions
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None

        # Calculate metrics
        metrics = self.calculate_metrics(model_type, y_test, y_pred, y_pred_proba)

        # Feature importance if available
        feature_importance = self.get_feature_importance(model, X.columns.tolist())

        # Create model metadata
        model_metadata = {
            'model_type': model_type,
            'algorithm': algorithm,
            'model_name': model_name,
            'user_id': user_id,
            'training_date': datetime.now().isoformat(),
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'features': X.columns.tolist(),
            'best_params': best_params,
            'feature_importance': feature_importance,
            'metrics': metrics,
            'model_class': ModelClass.__name__
        }

        # Save model
        model_path = self.save_model(model, model_metadata)

        logger.info(f"Model training completed. Best score: {metrics.get('best_score', 'N/A')}")

        return {
            'success': True,
            'model_path': model_path,
            'metadata': model_metadata,
            'metrics': metrics
        }

    def calculate_metrics(self, model_type: str, y_true: pd.Series, y_pred: np.ndarray,
                         y_pred_proba: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """Calculate model performance metrics"""
        metrics = {}

        if model_type == 'lead_conversion':
            # Classification metrics
            metrics.update({
                'accuracy': accuracy_score(y_true, y_pred),
                'precision': precision_score(y_true, y_pred, average='weighted'),
                'recall': recall_score(y_true, y_pred, average='weighted'),
                'f1_score': f1_score(y_true, y_pred, average='weighted'),
            })

            if y_pred_proba is not None:
                try:
                    # ROC AUC for binary classification
                    if len(np.unique(y_true)) == 2:
                        metrics['roc_auc'] = roc_auc_score(y_true, y_pred_proba[:, 1])
                    else:
                        metrics['roc_auc'] = roc_auc_score(y_true, y_pred_proba, multi_class='ovr')
                except:
                    metrics['roc_auc'] = None

        else:
            # Regression metrics
            metrics.update({
                'mean_squared_error': mean_squared_error(y_true, y_pred),
                'mean_absolute_error': mean_absolute_error(y_true, y_pred),
                'r2_score': r2_score(y_true, y_pred),
                'root_mean_squared_error': np.sqrt(mean_squared_error(y_true, y_pred))
            })

        return metrics

    def get_feature_importance(self, model: Any, feature_names: List[str]) -> Dict[str, float]:
        """Extract feature importance from model"""
        importance_dict = {}

        try:
            if hasattr(model, 'feature_importances_'):
                # Tree-based models
                importance = model.feature_importances_
            elif hasattr(model, 'coefs_'):
                # Linear models
                importance = np.abs(model.coefs_).flatten()
            else:
                # Default to equal importance
                importance = np.ones(len(feature_names)) / len(feature_names)

            # Normalize importance scores
            importance = importance / np.sum(importance)

            importance_dict = dict(zip(feature_names, importance))

        except Exception as e:
            logger.warning(f"Could not extract feature importance: {e}")
            importance_dict = {name: 1.0/len(feature_names) for name in feature_names}

        return importance_dict

    def save_model(self, model: Any, metadata: Dict[str, Any]) -> str:
        """Save trained model and metadata"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_name = metadata['model_name']
        user_id = metadata['user_id']

        # Create user-specific directory
        user_dir = os.path.join(self.model_dir, user_id)
        os.makedirs(user_dir, exist_ok=True)

        # Save model
        model_filename = f"{model_name}_{timestamp}.joblib"
        model_path = os.path.join(user_dir, model_filename)
        joblib.dump(model, model_path)

        # Save metadata
        metadata_filename = f"{model_name}_{timestamp}_metadata.json"
        metadata_path = os.path.join(user_dir, metadata_filename)
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)

        logger.info(f"Model saved to {model_path}")
        return model_path

    def load_model(self, model_path: str) -> Tuple[Any, Dict[str, Any]]:
        """Load trained model and metadata"""
        # Load model
        model = joblib.load(model_path)

        # Load metadata
        metadata_path = model_path.replace('.joblib', '_metadata.json')
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        return model, metadata

    def predict(self, model_path: str, X: pd.DataFrame) -> np.ndarray:
        """Make predictions using a trained model"""
        model, _ = self.load_model(model_path)
        return model.predict(X)

    def predict_proba(self, model_path: str, X: pd.DataFrame) -> np.ndarray:
        """Make probability predictions using a trained model"""
        model, _ = self.load_model(model_path)

        if hasattr(model, 'predict_proba'):
            return model.predict_proba(X)
        else:
            # For regression models, return prediction with confidence estimate
            predictions = model.predict(X)
            # Simple confidence estimate based on prediction magnitude
            confidence = np.minimum(np.abs(predictions) / 100, 0.9) + 0.1
            return np.column_stack([1 - confidence, confidence])

    def get_model_list(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of trained models for a user"""
        user_dir = os.path.join(self.model_dir, user_id)

        if not os.path.exists(user_dir):
            return []

        models = []
        for filename in os.listdir(user_dir):
            if filename.endswith('_metadata.json'):
                metadata_path = os.path.join(user_dir, filename)
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)

                model_path = metadata_path.replace('_metadata.json', '.joblib')
                models.append({
                    'model_path': model_path,
                    'metadata': metadata,
                    'file_size': os.path.getsize(model_path) if os.path.exists(model_path) else 0
                })

        return sorted(models, key=lambda x: x['metadata']['training_date'], reverse=True)

    def delete_model(self, model_path: str) -> bool:
        """Delete a trained model and its metadata"""
        try:
            # Delete model file
            if os.path.exists(model_path):
                os.remove(model_path)

            # Delete metadata file
            metadata_path = model_path.replace('.joblib', '_metadata.json')
            if os.path.exists(metadata_path):
                os.remove(metadata_path)

            logger.info(f"Model deleted: {model_path}")
            return True

        except Exception as e:
            logger.error(f"Error deleting model {model_path}: {e}")
            return False

    def cross_validate_model(self, model_type: str, algorithm: str, X: pd.DataFrame, y: pd.Series,
                           cv_folds: int = 5) -> Dict[str, Any]:
        """Perform cross-validation for model evaluation"""
        model_config = self.model_configs[model_type]['algorithms'][algorithm]
        ModelClass = model_config['model']

        model = ModelClass(random_state=42)

        # Perform cross-validation
        if model_type == 'lead_conversion':
            scores = cross_val_score(model, X, y, cv=cv_folds, scoring='accuracy')
            scoring_metrics = ['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
        else:
            scores = cross_val_score(model, X, y, cv=cv_folds, scoring='r2')
            scoring_metrics = ['r2', 'neg_mean_squared_error', 'neg_mean_absolute_error']

        cv_results = {}
        for metric in scoring_metrics:
            scores = cross_val_score(model, X, y, cv=cv_folds, scoring=metric)
            cv_results[metric] = {
                'mean': scores.mean(),
                'std': scores.std(),
                'min': scores.min(),
                'max': scores.max()
            }

        return cv_results
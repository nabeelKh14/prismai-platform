"""
Data Preprocessing Service for ML Prediction Engine
Handles feature engineering, data cleaning, and transformation
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
from typing import Dict, List, Any, Optional, Tuple
import json
import logging

logger = logging.getLogger(__name__)

class DataPreprocessor:
    """Handles data preprocessing for ML models"""

    def __init__(self):
        self.scalers = {}
        self.encoders = {}
        self.imputers = {}
        self.feature_selectors = {}

    def preprocess_lead_data(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """
        Preprocess lead data for ML training/prediction

        Args:
            df: Raw lead data DataFrame
            config: Preprocessing configuration

        Returns:
            Preprocessed DataFrame
        """
        logger.info(f"Starting preprocessing for {len(df)} leads")

        # Handle missing values
        df = self.handle_missing_values(df, config.get('missing_value_strategy', 'mean'))

        # Encode categorical variables
        df = self.encode_categorical_features(df, config.get('categorical_encoding', 'one_hot'))

        # Scale numerical features
        df = self.scale_features(df, config.get('scaling_method', 'standard'))

        # Feature selection
        df = self.select_features(df, config.get('feature_selection', {}))

        # Feature engineering
        df = self.engineer_features(df)

        logger.info(f"Preprocessing completed. Final shape: {df.shape}")
        return df

    def handle_missing_values(self, df: pd.DataFrame, strategy: str = 'mean') -> pd.DataFrame:
        """Handle missing values in the dataset"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object']).columns

        # For numeric columns
        if len(numeric_columns) > 0:
            if strategy == 'mean':
                imputer = SimpleImputer(strategy='mean')
            elif strategy == 'median':
                imputer = SimpleImputer(strategy='median')
            elif strategy == 'most_frequent':
                imputer = SimpleImputer(strategy='most_frequent')
            else:
                imputer = SimpleImputer(strategy='constant', fill_value=0)

            df[numeric_columns] = imputer.fit_transform(df[numeric_columns])

        # For categorical columns
        if len(categorical_columns) > 0:
            cat_imputer = SimpleImputer(strategy='constant', fill_value='unknown')
            df[categorical_columns] = cat_imputer.fit_transform(df[categorical_columns])

        return df

    def encode_categorical_features(self, df: pd.DataFrame, method: str = 'one_hot') -> pd.DataFrame:
        """Encode categorical features"""
        categorical_columns = df.select_dtypes(include=['object']).columns

        if method == 'one_hot':
            # One-hot encoding
            df = pd.get_dummies(df, columns=categorical_columns, drop_first=True)
        elif method == 'label':
            # Label encoding
            for col in categorical_columns:
                if col in df.columns:
                    encoder = LabelEncoder()
                    df[col] = encoder.fit_transform(df[col].astype(str))
                    self.encoders[col] = encoder

        return df

    def scale_features(self, df: pd.DataFrame, method: str = 'standard') -> pd.DataFrame:
        """Scale numerical features"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns

        if method == 'standard':
            scaler = StandardScaler()
        elif method == 'minmax':
            scaler = MinMaxScaler()
        else:
            return df  # No scaling

        df[numeric_columns] = scaler.fit_transform(df[numeric_columns])
        self.scalers['numeric'] = scaler

        return df

    def select_features(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Select most relevant features"""
        if not config or 'method' not in config:
            return df

        method = config['method']
        target_column = config.get('target_column')

        if not target_column or target_column not in df.columns:
            return df

        X = df.drop(columns=[target_column])
        y = df[target_column]

        if method == 'k_best':
            k = config.get('k', 10)
            selector = SelectKBest(score_func=f_classif, k=k)
            X_selected = selector.fit_transform(X, y)
            self.feature_selectors['k_best'] = selector

            # Get selected feature names
            selected_features = X.columns[selector.get_support()].tolist()
            logger.info(f"Selected {len(selected_features)} features: {selected_features}")

        elif method == 'mutual_info':
            k = config.get('k', 10)
            selector = SelectKBest(score_func=mutual_info_classif, k=k)
            X_selected = selector.fit_transform(X, y)
            self.feature_selectors['mutual_info'] = selector

        return df

    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create new features from existing ones"""
        # Time-based features
        if 'created_at' in df.columns:
            df['days_since_creation'] = (pd.Timestamp.now() - pd.to_datetime(df['created_at'])).dt.days
            df['hour_of_day'] = pd.to_datetime(df['created_at']).dt.hour
            df['day_of_week'] = pd.to_datetime(df['created_at']).dt.dayofweek

        # Interaction features
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        # Create ratios and interactions for key features
        if 'email_interactions' in df.columns and 'website_visits' in df.columns:
            df['email_to_visit_ratio'] = df['email_interactions'] / (df['website_visits'] + 1)

        if 'lead_score' in df.columns and 'engagement_score' in df.columns:
            df['score_interaction'] = df['lead_score'] * df['engagement_score']

        # Log transformations for skewed features
        skewed_features = ['time_since_creation', 'email_interactions', 'website_visits']
        for feature in skewed_features:
            if feature in df.columns:
                df[f'{feature}_log'] = np.log1p(df[feature])

        return df

    def validate_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Validate data quality and return quality metrics"""
        quality_report = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'missing_values': {},
            'data_types': {},
            'duplicates': df.duplicated().sum(),
            'quality_score': 0.0
        }

        # Check missing values
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            quality_report['missing_values'][col] = missing_count
            if missing_count > 0:
                quality_report['quality_score'] -= (missing_count / len(df)) * 10

        # Check data types
        for col in df.columns:
            quality_report['data_types'][col] = str(df[col].dtype)

        # Calculate final quality score
        quality_report['quality_score'] = max(0, min(100, 100 + quality_report['quality_score']))

        return quality_report

    def save_preprocessing_config(self, config_path: str):
        """Save preprocessing configuration to file"""
        config = {
            'scalers': {k: type(v).__name__ for k, v in self.scalers.items()},
            'encoders': list(self.encoders.keys()),
            'imputers': list(self.imputers.keys()),
            'feature_selectors': list(self.feature_selectors.keys())
        }

        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

    def load_preprocessing_config(self, config_path: str):
        """Load preprocessing configuration from file"""
        with open(config_path, 'r') as f:
            config = json.load(f)

        # Note: This would need to load actual objects in a real implementation
        logger.info(f"Loaded preprocessing config: {config}")

def create_lead_features(leads_data: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Create feature DataFrame from lead data

    Args:
        leads_data: List of lead dictionaries

    Returns:
        DataFrame with engineered features
    """
    df = pd.DataFrame(leads_data)

    # Basic feature engineering
    if 'created_at' in df.columns:
        df['days_since_creation'] = (pd.Timestamp.now() - pd.to_datetime(df['created_at'])).dt.days

    if 'company' in df.columns:
        df['company_size_score'] = df['company'].apply(estimate_company_size)

    if 'job_title' in df.columns:
        df['job_title_score'] = df['job_title'].apply(calculate_job_title_score)

    if 'email' in df.columns:
        df['email_domain_score'] = df['email'].apply(calculate_email_domain_score)

    # Fill missing values
    numeric_columns = df.select_dtypes(include=[np.number]).columns
    df[numeric_columns] = df[numeric_columns].fillna(df[numeric_columns].mean())

    categorical_columns = df.select_dtypes(include=['object']).columns
    df[categorical_columns] = df[categorical_columns].fillna('unknown')

    return df

def estimate_company_size(company: str) -> int:
    """Estimate company size based on company name"""
    if not company or pd.isna(company):
        return 1

    company_lower = company.lower()

    # Large companies
    if any(keyword in company_lower for keyword in ['inc', 'corp', 'corporation', 'ltd', 'limited']):
        return 50

    # Medium companies
    if any(keyword in company_lower for keyword in ['llc', 'llp', 'co', 'company']):
        return 25

    # Small companies
    return 10

def calculate_job_title_score(job_title: str) -> int:
    """Calculate score based on job title"""
    if not job_title or pd.isna(job_title):
        return 0

    title_lower = job_title.lower()

    # Decision makers
    decision_makers = ['ceo', 'cto', 'cfo', 'president', 'director', 'vp', 'vice president', 'founder', 'owner']
    if any(role in title_lower for role in decision_makers):
        return 25

    # Influencers
    influencers = ['senior', 'lead', 'manager', 'supervisor', 'coordinator']
    if any(role in title_lower for role in influencers):
        return 15

    # End users
    return 5

def calculate_email_domain_score(email: str) -> int:
    """Calculate score based on email domain"""
    if not email or pd.isna(email):
        return 0

    domain = email.split('@')[1].lower() if '@' in email else ''

    # Business domains
    business_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']
    if domain not in business_domains:
        return 15

    # Free email domains
    return -5
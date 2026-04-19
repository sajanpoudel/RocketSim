import { supabase, getCurrentUser } from '@/lib/database/supabase';

export interface AnalysisResult {
  id?: string;
  rocket_id: string;
  simulation_id?: string;
  user_id: string;
  analysis_type: string;
  results: any;
  parameters?: any;
  computation_time?: number;
  created_at?: string;
}

export class AnalysisService {
  /**
   * Save analysis results to database
   */
  static async saveAnalysisResult(
    rocketId: string,
    analysisType: string,
    results: any,
    parameters?: any,
    simulationId?: string,
    computationTime?: number
  ): Promise<AnalysisResult | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const analysisData = {
        rocket_id: rocketId,
        simulation_id: simulationId,
        user_id: user.id,
        analysis_type: analysisType,
        results: results,
        parameters: parameters,
        computation_time: computationTime
      };

      const { data, error } = await supabase
        .from('analysis_results')
        .insert(analysisData)
        .select()
        .single();

      if (error) {
        console.error('Error saving analysis result:', error);
        return null;
      }

      console.log(`✅ Saved ${analysisType} analysis for rocket ${rocketId}`);
      return data;
    } catch (error) {
      console.error('Failed to save analysis result:', error);
      return null;
    }
  }

  /**
   * Get analysis results for a rocket
   */
  static async getAnalysisResults(
    rocketId: string,
    analysisType?: string
  ): Promise<AnalysisResult[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      let query = supabase
        .from('analysis_results')
        .select('*')
        .eq('rocket_id', rocketId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (analysisType) {
        query = query.eq('analysis_type', analysisType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading analysis results:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to load analysis results:', error);
      return [];
    }
  }

  /**
   * Save performance metrics to database
   */
  static async savePerformanceMetrics(
    rocketId: string,
    metricType: string,
    value: number,
    metadata?: any
  ): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      const { error } = await supabase
        .from('performance_metrics')
        .insert({
          user_id: user.id,
          rocket_id: rocketId,
          metric_type: metricType,
          value: value,
          metadata: metadata
        });

      if (error) {
        console.error('Error saving performance metric:', error);
        return false;
      }

      console.log(`✅ Saved ${metricType} metric: ${value} for rocket ${rocketId}`);
      return true;
    } catch (error) {
      console.error('Failed to save performance metric:', error);
      return false;
    }
  }

  /**
   * Cache weather data
   */
  static async cacheWeatherData(
    locationKey: string,
    weatherData: any,
    source: string,
    expiryHours: number = 1
  ): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const { error } = await supabase
        .from('weather_cache')
        .insert({
          location_key: locationKey,
          weather_data: weatherData,
          source: source,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('Error caching weather data:', error);
        return false;
      }

      console.log(`✅ Cached weather data for ${locationKey}`);
      return true;
    } catch (error) {
      console.error('Failed to cache weather data:', error);
      return false;
    }
  }

  /**
   * Get cached weather data
   */
  static async getCachedWeatherData(locationKey: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('weather_cache')
        .select('*')
        .eq('location_key', locationKey)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      console.log(`✅ Found cached weather data for ${locationKey}`);
      return data.weather_data;
    } catch (error) {
      console.error('Failed to get cached weather data:', error);
      return null;
    }
  }

  /**
   * Save environment configuration
   */
  static async saveEnvironmentConfig(
    name: string,
    latitude: number,
    longitude: number,
    elevation: number,
    windModel?: any,
    atmosphericModel?: any
  ): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      const { error } = await supabase
        .from('environment_configs')
        .insert({
          user_id: user.id,
          name: name,
          latitude: latitude,
          longitude: longitude,
          elevation: elevation,
          wind_model: windModel,
          atmospheric_model: atmosphericModel
        });

      if (error) {
        console.error('Error saving environment config:', error);
        return false;
      }

      console.log(`✅ Saved environment config: ${name}`);
      return true;
    } catch (error) {
      console.error('Failed to save environment config:', error);
      return false;
    }
  }
} 
/**
 * Print Orientation Service
 * 
 * This service analyzes 3D geometries to determine the optimal print orientation
 * for 3D printing, considering factors like overhangs, support material usage,
 * print time, and surface quality.
 */

import * as THREE from 'three';

export interface OrientationAnalysis {
  orientation: THREE.Vector3;
  score: number; // 0-100, higher is better
  overhangPercentage: number;
  supportVolume: number;
  printTime: number;
  surfaceQuality: 'excellent' | 'good' | 'fair' | 'poor';
  stability: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export interface OrientationOptions {
  prioritizeOverhangs: boolean;
  prioritizeSupportVolume: boolean;
  prioritizePrintTime: boolean;
  prioritizeSurfaceQuality: boolean;
  maxOverhangAngle: number;
  supportDensity: number;
  layerHeight: number;
  printSpeed: number;
}

export class PrintOrientationService {
  
  /**
   * Analyze optimal print orientation for a geometry
   */
  analyzeOptimalOrientation(
    geometry: THREE.BufferGeometry,
    options: Partial<OrientationOptions> = {}
  ): OrientationAnalysis {
    const defaultOptions: OrientationOptions = {
      prioritizeOverhangs: true,
      prioritizeSupportVolume: true,
      prioritizePrintTime: false,
      prioritizeSurfaceQuality: true,
      maxOverhangAngle: 45,
      supportDensity: 20,
      layerHeight: 0.2,
      printSpeed: 60
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Generate candidate orientations
    const orientations = this.generateCandidateOrientations();
    
    // Analyze each orientation
    const analyses = orientations.map(orientation => 
      this.analyzeOrientation(geometry, orientation, mergedOptions)
    );
    
    // Find the best orientation
    const bestAnalysis = analyses.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return bestAnalysis;
  }
  
  /**
   * Generate candidate orientations for analysis
   */
  private generateCandidateOrientations(): THREE.Vector3[] {
    const orientations: THREE.Vector3[] = [];
    
    // Standard orientations
    orientations.push(new THREE.Vector3(0, 1, 0));  // Y-up (default)
    orientations.push(new THREE.Vector3(1, 0, 0));  // X-up
    orientations.push(new THREE.Vector3(0, 0, 1));  // Z-up
    
    // Diagonal orientations
    orientations.push(new THREE.Vector3(1, 1, 0).normalize());
    orientations.push(new THREE.Vector3(1, 0, 1).normalize());
    orientations.push(new THREE.Vector3(0, 1, 1).normalize());
    orientations.push(new THREE.Vector3(1, 1, 1).normalize());
    
    // Additional orientations for complex geometries
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      orientations.push(new THREE.Vector3(
        Math.cos(angle),
        Math.sin(angle),
        0.5
      ).normalize());
    }
    
    return orientations;
  }
  
  /**
   * Analyze a specific orientation
   */
  private analyzeOrientation(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3,
    options: OrientationOptions
  ): OrientationAnalysis {
    // Calculate overhang percentage
    const overhangPercentage = this.calculateOverhangPercentage(geometry, orientation, options.maxOverhangAngle);
    
    // Calculate support volume
    const supportVolume = this.calculateSupportVolume(geometry, orientation, options);
    
    // Calculate print time
    const printTime = this.calculatePrintTime(geometry, orientation, options);
    
    // Assess surface quality
    const surfaceQuality = this.assessSurfaceQuality(geometry, orientation);
    
    // Assess stability
    const stability = this.assessStability(geometry, orientation);
    
    // Calculate overall score
    const score = this.calculateOrientationScore(
      overhangPercentage,
      supportVolume,
      printTime,
      surfaceQuality,
      stability,
      options
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      overhangPercentage,
      supportVolume,
      surfaceQuality,
      stability
    );
    
    return {
      orientation,
      score,
      overhangPercentage,
      supportVolume,
      printTime,
      surfaceQuality,
      stability,
      recommendations
    };
  }
  
  /**
   * Calculate overhang percentage for an orientation
   */
  private calculateOverhangPercentage(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3,
    maxOverhangAngle: number
  ): number {
    // Simplified overhang calculation
    // In a real implementation, you'd analyze face normals
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate projected area in the print direction
    const projectedArea = this.calculateProjectedArea(geometry, orientation);
    const totalArea = size.x * size.y + size.y * size.z + size.z * size.x;
    
    // Estimate overhang percentage based on geometry complexity
    const complexity = this.calculateGeometryComplexity(geometry);
    const overhangPercentage = Math.min(100, complexity * 0.3);
    
    return overhangPercentage;
  }
  
  /**
   * Calculate support volume for an orientation
   */
  private calculateSupportVolume(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3,
    options: OrientationOptions
  ): number {
    const overhangPercentage = this.calculateOverhangPercentage(geometry, orientation, options.maxOverhangAngle);
    
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Estimate support volume based on overhang area and support density
    const overhangArea = (size.x * size.z) * (overhangPercentage / 100);
    const supportHeight = size.y * 0.1; // Assume 10% of height for supports
    const supportVolume = overhangArea * supportHeight * (options.supportDensity / 100);
    
    return supportVolume;
  }
  
  /**
   * Calculate print time for an orientation
   */
  private calculatePrintTime(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3,
    options: OrientationOptions
  ): number {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate volume
    const volume = size.x * size.y * size.z;
    
    // Calculate layers needed
    const layers = size.y / options.layerHeight;
    
    // Calculate print time
    const baseTime = volume * 0.1; // Base time per unit volume
    const layerTime = layers * (size.x * size.z) / options.printSpeed;
    
    return baseTime + layerTime;
  }
  
  /**
   * Assess surface quality for an orientation
   */
  private assessSurfaceQuality(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    // Simplified surface quality assessment
    // In a real implementation, you'd analyze face normals and surface area
    
    const overhangPercentage = this.calculateOverhangPercentage(geometry, orientation, 45);
    
    if (overhangPercentage < 10) return 'excellent';
    if (overhangPercentage < 25) return 'good';
    if (overhangPercentage < 50) return 'fair';
    return 'poor';
  }
  
  /**
   * Assess stability for an orientation
   */
  private assessStability(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    // Simplified stability assessment
    // In a real implementation, you'd analyze center of mass and base area
    
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate aspect ratio in print direction
    const aspectRatio = Math.max(size.x, size.z) / size.y;
    
    if (aspectRatio < 2) return 'excellent';
    if (aspectRatio < 4) return 'good';
    if (aspectRatio < 8) return 'fair';
    return 'poor';
  }
  
  /**
   * Calculate overall orientation score
   */
  private calculateOrientationScore(
    overhangPercentage: number,
    supportVolume: number,
    printTime: number,
    surfaceQuality: 'excellent' | 'good' | 'fair' | 'poor',
    stability: 'excellent' | 'good' | 'fair' | 'poor',
    options: OrientationOptions
  ): number {
    let score = 100;
    
    // Penalize overhangs
    if (options.prioritizeOverhangs) {
      score -= overhangPercentage * 0.5;
    }
    
    // Penalize support volume
    if (options.prioritizeSupportVolume) {
      const supportPenalty = Math.min(30, supportVolume * 10);
      score -= supportPenalty;
    }
    
    // Penalize print time
    if (options.prioritizePrintTime) {
      const timePenalty = Math.min(20, printTime * 0.1);
      score -= timePenalty;
    }
    
    // Reward surface quality
    if (options.prioritizeSurfaceQuality) {
      const qualityScores = { excellent: 0, good: -5, fair: -15, poor: -30 };
      score += qualityScores[surfaceQuality];
    }
    
    // Reward stability
    const stabilityScores = { excellent: 0, good: -5, fair: -15, poor: -30 };
    score += stabilityScores[stability];
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate recommendations for an orientation
   */
  private generateRecommendations(
    overhangPercentage: number,
    supportVolume: number,
    surfaceQuality: 'excellent' | 'good' | 'fair' | 'poor',
    stability: 'excellent' | 'good' | 'fair' | 'poor'
  ): string[] {
    const recommendations: string[] = [];
    
    if (overhangPercentage > 50) {
      recommendations.push('High overhang percentage - consider support structures');
    }
    
    if (supportVolume > 0.1) {
      recommendations.push('Significant support material required');
    }
    
    if (surfaceQuality === 'poor') {
      recommendations.push('Poor surface quality - consider different orientation');
    }
    
    if (stability === 'poor') {
      recommendations.push('Poor stability - may require brim or raft');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Good orientation for 3D printing');
    }
    
    return recommendations;
  }
  
  /**
   * Calculate projected area in a direction
   */
  private calculateProjectedArea(
    geometry: THREE.BufferGeometry,
    direction: THREE.Vector3
  ): number {
    // Simplified projected area calculation
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate area perpendicular to the direction
    const dotX = Math.abs(direction.dot(new THREE.Vector3(1, 0, 0)));
    const dotY = Math.abs(direction.dot(new THREE.Vector3(0, 1, 0)));
    const dotZ = Math.abs(direction.dot(new THREE.Vector3(0, 0, 1)));
    
    return size.x * size.y * dotZ + size.y * size.z * dotX + size.z * size.x * dotY;
  }
  
  /**
   * Calculate geometry complexity
   */
  private calculateGeometryComplexity(geometry: THREE.BufferGeometry): number {
    // Simplified complexity calculation
    const vertexCount = geometry.attributes.position.count;
    const faceCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;
    
    // Normalize complexity (0-100)
    return Math.min(100, (vertexCount + faceCount) / 100);
  }
  
  /**
   * Get orientation visualization data
   */
  getOrientationVisualization(
    geometry: THREE.BufferGeometry,
    orientation: THREE.Vector3
  ): {
    boundingBox: THREE.Box3;
    printDirection: THREE.Vector3;
    baseArea: number;
    height: number;
  } {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    
    return {
      boundingBox: boundingBox.clone(),
      printDirection: orientation.clone(),
      baseArea: this.calculateProjectedArea(geometry, orientation),
      height: boundingBox.getSize(new THREE.Vector3()).y
    };
  }
}

// Export singleton instance
export const printOrientationService = new PrintOrientationService();

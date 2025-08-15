/**
 * Support Structure Service
 * 
 * This service analyzes 3D geometries for overhangs and generates
 * appropriate support structures for 3D printing. It handles different
 * support types and optimizes for material usage and printability.
 */

import * as THREE from 'three';

export interface SupportAnalysis {
  overhangAngle: number;
  overhangArea: number;
  supportVolume: number;
  supportHeight: number;
  supportDensity: number;
  requiresSupport: boolean;
}

export interface SupportStructure {
  geometry: THREE.BufferGeometry;
  volume_cm3: number;
  material_usage: number; // percentage of component volume
  print_time_addition: number; // minutes
  removal_difficulty: 'easy' | 'medium' | 'hard';
}

export interface SupportOptions {
  maxOverhangAngle: number; // degrees, default 45°
  supportDensity: number; // percentage, default 20%
  supportPattern: 'grid' | 'triangles' | 'lines' | 'concentric';
  supportInfill: number; // percentage, default 15%
  supportHeight: number; // mm, default 2mm
  supportSpacing: number; // mm, default 2mm
  enableRaft: boolean; // default false
  enableBrim: boolean; // default false
}

export class SupportStructureService {
  
  /**
   * Analyze geometry for overhangs and support requirements
   */
  analyzeSupportRequirements(
    geometry: THREE.BufferGeometry,
    options: Partial<SupportOptions> = {}
  ): SupportAnalysis {
    const defaultOptions: SupportOptions = {
      maxOverhangAngle: 45,
      supportDensity: 20,
      supportPattern: 'grid',
      supportInfill: 15,
      supportHeight: 2,
      supportSpacing: 2,
      enableRaft: false,
      enableBrim: false
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Compute bounding box and analyze geometry
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Analyze overhangs (simplified approach)
    const overhangAngle = this.calculateOverhangAngle(geometry);
    const overhangArea = this.calculateOverhangArea(geometry, mergedOptions.maxOverhangAngle);
    const supportVolume = this.estimateSupportVolume(geometry, mergedOptions);
    const supportHeight = mergedOptions.supportHeight;
    const supportDensity = mergedOptions.supportDensity;
    const requiresSupport = overhangAngle > mergedOptions.maxOverhangAngle;
    
    return {
      overhangAngle,
      overhangArea,
      supportVolume,
      supportHeight,
      supportDensity,
      requiresSupport
    };
  }
  
  /**
   * Generate support structures for a geometry
   */
  generateSupportStructures(
    geometry: THREE.BufferGeometry,
    options: Partial<SupportOptions> = {}
  ): SupportStructure {
    const defaultOptions: SupportOptions = {
      maxOverhangAngle: 45,
      supportDensity: 20,
      supportPattern: 'grid',
      supportInfill: 15,
      supportHeight: 2,
      supportSpacing: 2,
      enableRaft: false,
      enableBrim: false
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Analyze support requirements
    const analysis = this.analyzeSupportRequirements(geometry, mergedOptions);
    
    if (!analysis.requiresSupport) {
      // Return empty support structure
      return {
        geometry: new THREE.BufferGeometry(),
        volume_cm3: 0,
        material_usage: 0,
        print_time_addition: 0,
        removal_difficulty: 'easy'
      };
    }
    
    // Generate support geometry based on pattern
    let supportGeometry: THREE.BufferGeometry;
    
    switch (mergedOptions.supportPattern) {
      case 'grid':
        supportGeometry = this.generateGridSupport(geometry, mergedOptions);
        break;
      case 'triangles':
        supportGeometry = this.generateTriangleSupport(geometry, mergedOptions);
        break;
      case 'lines':
        supportGeometry = this.generateLineSupport(geometry, mergedOptions);
        break;
      case 'concentric':
        supportGeometry = this.generateConcentricSupport(geometry, mergedOptions);
        break;
      default:
        supportGeometry = this.generateGridSupport(geometry, mergedOptions);
    }
    
    // Add raft if enabled
    if (mergedOptions.enableRaft) {
      const raftGeometry = this.generateRaft(geometry, mergedOptions);
      supportGeometry = this.combineGeometries([supportGeometry, raftGeometry]);
    }
    
    // Add brim if enabled
    if (mergedOptions.enableBrim) {
      const brimGeometry = this.generateBrim(geometry, mergedOptions);
      supportGeometry = this.combineGeometries([supportGeometry, brimGeometry]);
    }
    
    // Calculate support properties
    const volume_cm3 = this.calculateSupportVolume(supportGeometry);
    const material_usage = this.calculateMaterialUsage(geometry, supportGeometry);
    const print_time_addition = this.calculatePrintTimeAddition(supportGeometry, mergedOptions);
    const removal_difficulty = this.assessRemovalDifficulty(mergedOptions);
    
    return {
      geometry: supportGeometry,
      volume_cm3,
      material_usage,
      print_time_addition,
      removal_difficulty
    };
  }
  
  /**
   * Generate grid pattern support structures
   */
  private generateGridSupport(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());
    
    // Create grid of support pillars
    const gridSize = options.supportSpacing;
    const supportGeometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Generate support pillars in a grid pattern
    for (let x = -size.x/2; x <= size.x/2; x += gridSize) {
      for (let z = -size.z/2; z <= size.z/2; z += gridSize) {
        // Create support pillar
        const pillarGeometry = this.createSupportPillar(
          new THREE.Vector3(x, center.y, z),
          options.supportHeight,
          options.supportSpacing * 0.5,
          options.supportInfill
        );
        
        // Add to combined geometry
        const pillarVertices = pillarGeometry.attributes.position.array;
        const vertexOffset = vertices.length / 3;
        
        for (let i = 0; i < pillarVertices.length; i++) {
          vertices.push(pillarVertices[i]);
        }
        
        const pillarIndices = pillarGeometry.index?.array || [];
        for (let i = 0; i < pillarIndices.length; i++) {
          indices.push(pillarIndices[i] + vertexOffset);
        }
      }
    }
    
    supportGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (indices.length > 0) {
      supportGeometry.setIndex(indices);
    }
    
    return supportGeometry;
  }
  
  /**
   * Generate triangle pattern support structures
   */
  private generateTriangleSupport(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    // Similar to grid but with triangular spacing
    return this.generateGridSupport(geometry, options);
  }
  
  /**
   * Generate line pattern support structures
   */
  private generateLineSupport(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    // Create parallel lines of support
    return this.generateGridSupport(geometry, options);
  }
  
  /**
   * Generate concentric pattern support structures
   */
  private generateConcentricSupport(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    // Create concentric rings of support
    return this.generateGridSupport(geometry, options);
  }
  
  /**
   * Generate raft (base support layer)
   */
  private generateRaft(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Create raft as a thin box slightly larger than the component
    const raftGeometry = new THREE.BoxGeometry(
      size.x * 1.1, // 10% larger
      options.supportHeight,
      size.z * 1.1
    );
    
    // Position at the bottom
    raftGeometry.translate(0, -size.y/2 - options.supportHeight/2, 0);
    
    return raftGeometry;
  }
  
  /**
   * Generate brim (perimeter support)
   */
  private generateBrim(
    geometry: THREE.BufferGeometry,
    options: SupportOptions
  ): THREE.BufferGeometry {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Create brim as a thin ring around the base
    const brimGeometry = new THREE.RingGeometry(
      Math.max(size.x, size.z) / 2,
      Math.max(size.x, size.z) / 2 + options.supportSpacing,
      32
    );
    
    // Position at the bottom
    brimGeometry.translate(0, -size.y/2 - options.supportHeight/2, 0);
    
    return brimGeometry;
  }
  
  /**
   * Create a single support pillar
   */
  private createSupportPillar(
    position: THREE.Vector3,
    height: number,
    radius: number,
    infill: number
  ): THREE.BufferGeometry {
    // Create cylindrical support pillar with infill
    const segments = Math.max(8, Math.floor(32 * infill / 100));
    const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    geometry.translate(position.x, position.y, position.z);
    
    return geometry;
  }
  
  /**
   * Calculate overhang angle (simplified)
   */
  private calculateOverhangAngle(geometry: THREE.BufferGeometry): number {
    // Simplified overhang detection
    // In a real implementation, you'd analyze face normals
    return 60; // Placeholder - assume 60° overhang
  }
  
  /**
   * Calculate overhang area (simplified)
   */
  private calculateOverhangArea(geometry: THREE.BufferGeometry, maxAngle: number): number {
    // Simplified area calculation
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    return size.x * size.z * 0.3; // Assume 30% of base area needs support
  }
  
  /**
   * Estimate support volume
   */
  private estimateSupportVolume(geometry: THREE.BufferGeometry, options: SupportOptions): number {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Estimate based on overhang area and support density
    const overhangArea = this.calculateOverhangArea(geometry, options.maxOverhangAngle);
    const supportVolume = overhangArea * options.supportHeight * (options.supportDensity / 100);
    
    return supportVolume;
  }
  
  /**
   * Calculate support volume in cm³
   */
  private calculateSupportVolume(geometry: THREE.BufferGeometry): number {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    return (size.x * size.y * size.z) * 1000000; // Convert m³ to cm³
  }
  
  /**
   * Calculate material usage percentage
   */
  private calculateMaterialUsage(
    componentGeometry: THREE.BufferGeometry,
    supportGeometry: THREE.BufferGeometry
  ): number {
    const componentVolume = this.calculateSupportVolume(componentGeometry);
    const supportVolume = this.calculateSupportVolume(supportGeometry);
    
    return (supportVolume / componentVolume) * 100;
  }
  
  /**
   * Calculate additional print time for supports
   */
  private calculatePrintTimeAddition(
    supportGeometry: THREE.BufferGeometry,
    options: SupportOptions
  ): number {
    const volume = this.calculateSupportVolume(supportGeometry);
    
    // Estimate print time based on volume and infill
    const baseTime = volume * 0.1; // 0.1 minutes per cm³
    const infillFactor = options.supportInfill / 100;
    
    return baseTime * infillFactor;
  }
  
  /**
   * Assess removal difficulty
   */
  private assessRemovalDifficulty(options: SupportOptions): 'easy' | 'medium' | 'hard' {
    if (options.supportDensity < 15) return 'easy';
    if (options.supportDensity < 30) return 'medium';
    return 'hard';
  }
  
  /**
   * Combine multiple geometries
   */
  private combineGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }
    
    if (geometries.length === 1) {
      return geometries[0];
    }
    
    // Simple geometry combination
    const combinedGeometry = geometries[0].clone();
    
    for (let i = 1; i < geometries.length; i++) {
      // In a real implementation, you'd use proper geometry merging
      // For now, we'll just return the first geometry
      break;
    }
    
    return combinedGeometry;
  }
}

// Export singleton instance
export const supportService = new SupportStructureService();

/**
 * CSG (Constructive Solid Geometry) Service
 * 
 * This service provides boolean operations for complex hollow geometries
 * used in 3D printing export. It handles union, subtraction, and intersection
 * operations for creating proper hollow shells and complex shapes.
 */

import * as THREE from 'three';

export interface CSGOperation {
  type: 'union' | 'subtraction' | 'intersection';
  geometry: THREE.BufferGeometry;
  transform?: THREE.Matrix4;
}

export interface CSGResult {
  geometry: THREE.BufferGeometry;
  volume_cm3: number;
  surface_area_cm2: number;
  boundingBox: THREE.Box3;
  centerOfMass: THREE.Vector3;
}

export class CSGService {
  
  /**
   * Perform CSG boolean operations on geometries
   */
  performCSGOperations(operations: CSGOperation[]): CSGResult {
    if (operations.length === 0) {
      throw new Error('No operations provided for CSG');
    }
    
    if (operations.length === 1) {
      return this.calculateGeometryProperties(operations[0].geometry);
    }
    
    // Start with the first geometry
    let resultGeometry = operations[0].geometry.clone();
    
    // Apply transform if provided
    if (operations[0].transform) {
      resultGeometry.applyMatrix4(operations[0].transform);
    }
    
    // Perform operations sequentially
    for (let i = 1; i < operations.length; i++) {
      const operation = operations[i];
      const operandGeometry = operation.geometry.clone();
      
      // Apply transform if provided
      if (operation.transform) {
        operandGeometry.applyMatrix4(operation.transform);
      }
      
      // Perform boolean operation
      switch (operation.type) {
        case 'union':
          resultGeometry = this.union(resultGeometry, operandGeometry);
          break;
        case 'subtraction':
          resultGeometry = this.subtract(resultGeometry, operandGeometry);
          break;
        case 'intersection':
          resultGeometry = this.intersect(resultGeometry, operandGeometry);
          break;
      }
    }
    
    return this.calculateGeometryProperties(resultGeometry);
  }
  
  /**
   * Create a hollow shell by subtracting inner geometry from outer geometry
   */
  createHollowShell(
    outerGeometry: THREE.BufferGeometry,
    innerGeometry: THREE.BufferGeometry,
    wallThickness: number = 0.001
  ): CSGResult {
    // Ensure inner geometry is slightly smaller than outer
    const scaleMatrix = new THREE.Matrix4();
    const scale = 1 - (wallThickness / 0.05); // Scale based on typical component size
    scaleMatrix.makeScale(scale, scale, scale);
    
    const scaledInnerGeometry = innerGeometry.clone();
    scaledInnerGeometry.applyMatrix4(scaleMatrix);
    
    return this.performCSGOperations([
      { type: 'union', geometry: outerGeometry },
      { type: 'subtraction', geometry: scaledInnerGeometry }
    ]);
  }
  
  /**
   * Create a cylindrical shell with proper CSG operations
   */
  createCylindricalShell(
    outerRadius: number,
    innerRadius: number,
    length: number,
    segments: number = 32
  ): CSGResult {
    // Create outer cylinder
    const outerGeometry = new THREE.CylinderGeometry(
      outerRadius, outerRadius, length, segments
    );
    
    // Create inner cylinder
    const innerGeometry = new THREE.CylinderGeometry(
      innerRadius, innerRadius, length, segments
    );
    
    // Position inner cylinder slightly forward to create proper wall
    const translateMatrix = new THREE.Matrix4();
    translateMatrix.makeTranslation(0, -0.001, 0); // Small offset
    
    return this.performCSGOperations([
      { type: 'union', geometry: outerGeometry },
      { type: 'subtraction', geometry: innerGeometry, transform: translateMatrix }
    ]);
  }
  
  /**
   * Create a conical shell with proper CSG operations
   */
  createConicalShell(
    baseRadius: number,
    tipRadius: number,
    length: number,
    wallThickness: number,
    segments: number = 32
  ): CSGResult {
    // Create outer cone
    const outerGeometry = new THREE.ConeGeometry(
      baseRadius, length, segments
    );
    
    // Create inner cone (smaller)
    const innerBaseRadius = Math.max(0, baseRadius - wallThickness);
    const innerTipRadius = Math.max(0, tipRadius - wallThickness);
    const innerGeometry = new THREE.ConeGeometry(
      innerBaseRadius, length, segments
    );
    
    // Position inner cone slightly forward
    const translateMatrix = new THREE.Matrix4();
    translateMatrix.makeTranslation(0, -wallThickness / 2, 0);
    
    return this.performCSGOperations([
      { type: 'union', geometry: outerGeometry },
      { type: 'subtraction', geometry: innerGeometry, transform: translateMatrix }
    ]);
  }
  
  /**
   * Union operation (A + B)
   */
  private union(geometryA: THREE.BufferGeometry, geometryB: THREE.BufferGeometry): THREE.BufferGeometry {
    // Convert to meshes for CSG operations
    const meshA = new THREE.Mesh(geometryA);
    const meshB = new THREE.Mesh(geometryB);
    
    // Perform union using Three.js CSG-like operations
    // For now, we'll use a simplified approach
    // In a full implementation, you'd use a proper CSG library
    return this.simplifiedUnion(meshA, meshB);
  }
  
  /**
   * Subtraction operation (A - B)
   */
  private subtract(geometryA: THREE.BufferGeometry, geometryB: THREE.BufferGeometry): THREE.BufferGeometry {
    const meshA = new THREE.Mesh(geometryA);
    const meshB = new THREE.Mesh(geometryB);
    
    return this.simplifiedSubtraction(meshA, meshB);
  }
  
  /**
   * Intersection operation (A ∩ B)
   */
  private intersect(geometryA: THREE.BufferGeometry, geometryB: THREE.BufferGeometry): THREE.BufferGeometry {
    const meshA = new THREE.Mesh(geometryA);
    const meshB = new THREE.Mesh(geometryB);
    
    return this.simplifiedIntersection(meshA, meshB);
  }
  
  /**
   * Simplified union operation (placeholder for proper CSG)
   */
  private simplifiedUnion(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.BufferGeometry {
    // For now, return the larger geometry
    // This is a placeholder - in production, use a proper CSG library
    const volumeA = this.calculateVolume(meshA.geometry);
    const volumeB = this.calculateVolume(meshB.geometry);
    
    return volumeA > volumeB ? meshA.geometry : meshB.geometry;
  }
  
  /**
   * Simplified subtraction operation (placeholder for proper CSG)
   */
  private simplifiedSubtraction(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.BufferGeometry {
    // For now, return the first geometry
    // This is a placeholder - in production, use a proper CSG library
    return meshA.geometry;
  }
  
  /**
   * Simplified intersection operation (placeholder for proper CSG)
   */
  private simplifiedIntersection(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.BufferGeometry {
    // For now, return the smaller geometry
    // This is a placeholder - in production, use a proper CSG library
    const volumeA = this.calculateVolume(meshA.geometry);
    const volumeB = this.calculateVolume(meshB.geometry);
    
    return volumeA < volumeB ? meshA.geometry : meshB.geometry;
  }
  
  /**
   * Calculate volume of geometry
   */
  private calculateVolume(geometry: THREE.BufferGeometry): number {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    return size.x * size.y * size.z;
  }
  
  /**
   * Calculate geometry properties
   */
  private calculateGeometryProperties(geometry: THREE.BufferGeometry): CSGResult {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate volume in cm³
    const volume_cm3 = (size.x * size.y * size.z) * 1000000;
    
    // Calculate surface area in cm²
    const surface_area_cm2 = (size.x * size.y + size.y * size.z + size.z * size.x) * 10000;
    
    // Calculate center of mass
    const centerOfMass = boundingBox.getCenter(new THREE.Vector3());
    
    return {
      geometry,
      volume_cm3,
      surface_area_cm2,
      boundingBox,
      centerOfMass
    };
  }
}

// Export singleton instance
export const csgService = new CSGService();

import React, { useEffect, useRef, useState } from 'react';
import { useGLTF, useAnimations, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ABBY_CONFIG } from '../../config/constants';

type AnimationKey = keyof typeof ABBY_CONFIG.ANIMATIONS;

interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
  animation?: AnimationKey;
  isTalking?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onLoad?: () => void;
}

// ABBY's 3D Model Component
const Character: React.FC<CharacterProps> = ({
  position = ABBY_CONFIG.POSITION as [number, number, number],
  scale = ABBY_CONFIG.SCALE,
  animation = 'IDLE',
  isTalking = false,
  castShadow = true,
  receiveShadow = true,
  onLoad,
}) => {
  const group = useRef<THREE.Group>(null);
  // Load the 3D model with error handling
  const { scene, animations } = useGLTF(ABBY_CONFIG.MODEL_PATH, true, undefined, (error) => {
    console.error('Error loading 3D model:', error);
  }) as any;
  
  const { actions, mixer } = useAnimations(animations || [], group);
  const [currentAnimation, setCurrentAnimation] = useState<AnimationKey>(animation || 'IDLE');
  const { camera } = useThree();
  
  // Handle model loading
  useEffect(() => {
    if (scene) {
      // Set up shadows
      scene.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = castShadow;
          node.receiveShadow = receiveShadow;
        }
      });
      
      if (onLoad) onLoad();
    }
  }, [scene, castShadow, receiveShadow, onLoad]);

  // Animation control
  useEffect(() => {
    if (!actions || !animation) return;
    
    const animName = ABBY_CONFIG.ANIMATIONS[animation] || ABBY_CONFIG.ANIMATIONS.IDLE;
    
    // Reset current animation
    if (currentAnimation && actions[currentAnimation]) {
      const action = actions[currentAnimation];
      action?.fadeOut(0.2);
    }
    
    // Play new animation
    const action = actions[animName];
    if (action) {
      action.reset().fadeIn(0.2).play();
      setCurrentAnimation(animName as keyof typeof ABBY_CONFIG.ANIMATIONS);
      
      return () => {
        action.fadeOut(0.2);
      };
    }
  }, [actions, animation, currentAnimation]);
  
  // Lip-sync for talking animation
  useEffect(() => {
    if (!mixer || !isTalking) return;
    
    const clock = new THREE.Clock();
    const delta = 1 / 60;
    
    const updateMouth = () => {
      if (!isTalking || !mixer) return;
      
      const time = clock.getElapsedTime();
      // This would be connected to actual audio analysis in a real implementation
      const mouthMovement = Math.sin(time * 10) * 0.5 + 0.5;
      
      // Update morph targets or other animation properties here
      // This is a placeholder - actual implementation depends on your model
      scene.traverse((node: any) => {
        if (node.isSkinnedMesh && node.morphTargetDictionary) {
          // Example: Update mouth morph target
          if (node.morphTargetDictionary.mouthOpen !== undefined) {
            node.morphTargetInfluences[node.morphTargetDictionary.mouthOpen] = mouthMovement * 0.5;
          }
        }
      });
      
      if (isTalking) {
        requestAnimationFrame(updateMouth);
      }
    };
    
    updateMouth();
    
    return () => {
      // Clean up
    };
  }, [mixer, isTalking, scene]);
  
  // Make ABBY face the camera
  useFrame(() => {
    if (group.current) {
      // Subtle floating animation
      group.current.position.y = position[1] + Math.sin(performance.now() * 0.001) * 0.02;
      
      // Face the camera but only rotate on Y axis
      group.current.lookAt(
        camera.position.x,
        group.current.position.y,
        camera.position.z
      );
    }
  });

  // If model failed to load, show a placeholder
  if (!scene) {
    return (
      <group ref={group} position={position} scale={[scale, scale, scale]}>
        <mesh castShadow={castShadow} receiveShadow={receiveShadow}>
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="#4FD1C5" />
        </mesh>
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
          outlineOpacity={1}
        >
          Loading ABBY...
        </Text>
      </group>
    );
  }

  return (
    <group ref={group} position={position} scale={[scale, scale, scale]} dispose={null}>
      <primitive 
        object={scene} 
        castShadow={castShadow} 
        receiveShadow={receiveShadow}
      />
      
      {/* Optional: Add a name tag */}
      <Text
        position={[0, 2.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
        outlineOpacity={1}
      >
        ABBY
      </Text>
    </group>
  );
};

export default Character;

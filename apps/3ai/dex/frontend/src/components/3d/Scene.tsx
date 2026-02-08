import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { Box } from '@chakra-ui/react';

interface SceneProps {
  children: React.ReactNode;
  cameraPosition?: [number, number, number];
  enableZoom?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  autoRotate?: boolean;
  style?: React.CSSProperties;
}

export const Scene: React.FC<SceneProps> = ({
  children,
  cameraPosition = [0, 0, 5],
  enableZoom = true,
  enablePan = true,
  enableRotate = true,
  autoRotate = false,
  style,
}) => {
  return (
    <Box
      width="100%"
      height="100%"
      position="relative"
      style={style}
    >
      <Canvas
        camera={{ position: cameraPosition, fov: 50 }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <OrbitControls
            enableZoom={enableZoom}
            enablePan={enablePan}
            enableRotate={enableRotate}
            autoRotate={autoRotate}
            autoRotateSpeed={1.0}
          />
          <Environment preset="city" />
          {children}
        </Suspense>
      </Canvas>
    </Box>
  );
};

export default Scene;

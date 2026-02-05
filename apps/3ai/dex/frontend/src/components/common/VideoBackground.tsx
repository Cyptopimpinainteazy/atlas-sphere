import React from 'react';
import { Box, BoxProps } from '@chakra-ui/react';

interface VideoBackgroundProps extends BoxProps {
  videoSrc: string;
  children?: React.ReactNode;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  videoSrc,
  children,
  ...rest
}) => {
  return (
    <Box
      position="relative"
      width="100%"
      height="100%"
      overflow="hidden"
      {...rest}
    >
      <Box
        as="video"
        autoPlay
        loop
        muted
        playsInline
        position="absolute"
        top="50%"
        left="50%"
        minWidth="100%"
        minHeight="100%"
        width="auto"
        height="auto"
        transform="translate(-50%, -50%)"
        zIndex={0}
        objectFit="cover"
      >
        <source src={videoSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </Box>
      <Box position="relative" zIndex={1}>
        {children}
      </Box>
    </Box>
  );
};

export default VideoBackground;

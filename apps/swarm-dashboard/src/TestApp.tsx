import React from 'react';

export const TestApp: React.FC = () => {
  React.useEffect(() => {
    console.log('TestApp mounted');
  }, []);

  return React.createElement('div', {
    style: {
      width: '100vw',
      height: '100vh',
      backgroundColor: '#020617',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
    },
  }, 'GPU Swarm Dashboard is Running!');
};

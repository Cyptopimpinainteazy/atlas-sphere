# ABBY AI Assistant Integration

ABBY is the AI assistant for 3aiXchange, providing users with an interactive and intfrontend/uitive way to interact with the DEX.

## Features

- **3D Character**: Interactive 3D model with animations
- **Chat Interface**: Natural language interaction with the DEX
- **Blockchain Integration**: Direct interaction with the 3ai blockchain
- **Responsive Design**: Works on both desktop and mobile devices

## Directory Structure

```
src/
├── components/
│   ├── abby/
│   │   ├── AbbyContainer.tsx    # Main container for ABBY
│   │   ├── ChatInterface.tsx    # Chat UI component
│   │   └── index.ts             # Exports
│   └── 3d/
│       └── Character.tsx        # 3D character component
├── pages/
│   └── abby.tsx                # ABBY page
└── services/
    └── abbyService.ts          # Service for ABBY's functionality
```

## Setup

1. **3D Model**: Place ABBY's 3D model in `public/models/abby/`
   - Supported formats: .glb, .gltf
   - Update the model path in `src/config/constants.ts`

2. **Animations**: Define animations in `src/config/constants.ts`
   ```typescript
   ANIMATIONS: {
     IDLE: 'idle',
     TALKING: 'talking',
     THINKING: 'thinking',
     SUCCESS: 'success',
     ERROR: 'error'
   }
   ```

3. **Environment Variables**:
   ```
   NEXT_PUBLIC_ABBY_API_KEY=your_api_key
   NEXT_PUBLIC_3AI_RPC_URL=your_rpc_url
   ```

## Usage

1. **Basic Implementation**:
   ```tsx
   import { AbbyContainer } from '@/components/abby';
   
   function App() {
     return <AbbyContainer />;
   }
   ```

2. **Customization**:
   - Position and scale can be adjusted in the config
   - Custom animations can be added to the 3D model
   - Chat interface can be styled using Chakra UI props

## Development

1. **Adding New Features**:
   - Add new animation states to `constants.ts`
   - Update the 3D model with new animations
   - Extend the chat interface with new message types

2. **Testing**:
   - Test animations with different screen sizes
   - Verify blockchain interactions
   - Check mobile responsiveness

## Troubleshooting

- **Model Not Loading**:
  - Check the model path in `constants.ts`
  - Verify the file format is supported
  - Check browser console for errors

- **Animations Not Working**:
  - Verify animation names match those in the 3D model
  - Check the animation state management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License.

# Atlas Sphere Media Assets

Place your custom media files in this directory to use them on the quantum landing page.

## Supported File Types
- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.frontend/webp`, `.svg`
- **Videos**: `.mp4`, `.frontend/webm`
- **Icons**: `.svg`, `.ico`

## Directory Structure
```
media/
├── heroes/           # Hero section backgrounds
├── gallery/          # Gallery and carousel images
├── team/             # Team member photos
├── partners/         # Partner/sponsor logos
├── products/         # Product screenshots
├── icons/            # Custom icons
├── videos/           # Video backgrounds
└── misc/             # Other media assets
```

## Usage in Components

Reference images from the public folder:
```tsx
// In React components
<img src="/media/gallery/image1.jpg" alt="Description" />

// In CSS
background-image: url('/media/heroes/hero-bg.jpg');
```

## Recommended Dimensions

| Use Case           | Dimensions             | Format    |
| ------------------ | ---------------------- | --------- |
| Hero backgrounds   | 1920x1080 or 3840x2160 | WebP, JPG |
| Gallery cards      | 400x400 or 600x600     | WebP, JPG |
| Cube gallery       | 400x400 (square)       | WebP, JPG |
| Slider backgrounds | 1920x1080              | WebP, JPG |
| Logos              | 200x200 or vector      | SVG, PNG  |

## Current Gallery Configuration

The HorizontalGallery component uses these image URLs by default. Replace with your own:

### Gallery Track Images (12 images)
1. Quantum Chain - Blockchain visual
2. Neural Net - AI network visualization  
3. Data Centers - Server infrastructure
4. Quantum Shield - Security concept
5. GPU Swarm - Graphics hardware
6. Atlas AI - Artificial intelligence
7. Global Mesh - World network
8. Data Stream - Matrix/data flow
9. X3 Lang - Code/programming
10. Atlas Token - Cryptocurrency
11. Holo UI - Holographic interface
12. Metaverse - Future city

### To use your own images:
1. Add images to `/public/media/gallery/`
2. Update the image paths in the component or pass custom images prop

## Performance Tips
- Use WebP format for best compression
- Lazy load images below the fold
- Use responsive images with srcset
- Optimize images before uploading (aim for <200KB per gallery image)

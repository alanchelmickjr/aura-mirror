# Aura Mirror ✨

A magical emotion-sensing mirror that uses AI to detect your feelings and displays beautiful, personalized aura visualizations in real-time.

## 🚀 Tech Stack

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Hume AI](https://img.shields.io/badge/Hume_AI-FF6B6B?style=for-the-badge&logo=ai&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

## ✨ What is Aura Mirror?

Aura Mirror is an interactive web application that combines computer vision with emotion AI to create a mystical mirror experience. Using your device's camera, it analyzes your facial expressions in real-time and generates beautiful, color-coded aura visualizations that reflect your current emotional state.

### Features

- 🎭 **Real-time Emotion Detection** - Powered by Hume AI's emotion recognition
- 🌈 **Dynamic Aura Visualization** - Beautiful particle effects that respond to your emotions
- 📱 **Mobile Responsive** - Works seamlessly on desktop and mobile devices
- ✨ **Magical UI** - Ornate mirror frame with mystical styling
- 🎨 **Color-coded Emotions** - Each emotion has its own unique color palette
- 🔮 **Particle Effects** - Floating magical particles that react to detected emotions

## 🛠️ Setup & Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd aura-mirror
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   Create a `.env.local` file and add your Hume AI credentials:
   \`\`\`env
   HUME_API_KEY=your_hume_api_key
   HUME_SECRET_KEY=your_hume_secret_key
   NEXT_PUBLIC_HUME_API_KEY=your_hume_api_key
   \`\`\`

4. **Run the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open your browser**
   Navigate to `http://localhost:3000` and allow camera permissions

## 🎮 How to Use

1. **Allow Camera Access** - Grant permission when prompted
2. **Look into the Mirror** - Position your face in the camera view
3. **Watch Your Aura** - See your emotions visualized as colorful aura effects
4. **Explore Different Emotions** - Try different expressions to see how your aura changes

## 🎨 Emotion Color Mapping

- **Joy** - Warm golden yellows and oranges
- **Sadness** - Cool blues and purples  
- **Anger** - Intense reds and crimsons
- **Fear** - Dark purples and grays
- **Surprise** - Bright whites and silvers
- **Disgust** - Greens and earth tones

## 🔧 Technical Details

- Built with **Next.js 14** and **TypeScript** for type safety
- Styled with **Tailwind CSS** for responsive design
- Uses **Hume AI** for advanced emotion recognition
- Real-time camera processing with HTML5 Canvas
- Optimized for both desktop and mobile experiences

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

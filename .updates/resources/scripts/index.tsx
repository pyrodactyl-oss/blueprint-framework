import { createRoot } from 'react-dom/client';

import App from '@/components/App';

import './blueprint/css/extensions.css';

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error('Failed to find the root element');
}

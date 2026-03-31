
import React, { useState, useEffect } from 'react';

interface SystemMessageProps {
    message: string | null;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
    const [visible, setVisible] = useState(false);
    const [currentMessage, setCurrentMessage] = useState('');

    useEffect(() => {
        if (message && message.trim()) {
            setCurrentMessage(message);
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
            }, 4000); // Display for 4 seconds
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <div 
            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-all duration-1000 ease-out
            ${visible ? 'opacity-100 translate-y-[-50%]' : 'opacity-0 translate-y-[-40%]'}`}
        >
            <p className="text-xl text-center text-pink-200 font-crt max-w-md" style={{ textShadow: '0 0 10px rgba(255, 182, 193, 0.8), 0 0 5px rgba(255, 182, 193, 0.5)' }}>
                {currentMessage}
            </p>
        </div>
    );
};

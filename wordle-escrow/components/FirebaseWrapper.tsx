import React from 'react';
import { isFirebaseConfigured } from '../firebase';

const FirebaseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!isFirebaseConfigured) {
        return (
            <div className="min-h-screen bg-wordle-dark text-wordle-light flex items-center justify-center p-4">
                <div className="max-w-2xl text-center bg-gray-800 p-8 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold text-red-400 mb-4">Firebase Not Configured</h1>
                    <p className="text-gray-300 mb-2">
                        To enable real-time score sharing, you need to set up a Firebase project.
                    </p>
                    <p className="text-gray-400 mb-6">
                        Please create a file named <code className="bg-gray-900 text-yellow-400 p-1 rounded">firebase.ts</code> in the root directory and add your Firebase project configuration to it.
                    </p>
                    <a 
                        href="https://console.firebase.google.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block bg-wordle-green text-white font-bold py-2 px-6 rounded-md hover:bg-green-600 transition duration-200"
                    >
                        Go to Firebase Console
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default FirebaseWrapper;

import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans flex items-center justify-center text-center p-4">
            <div>
                <h1 className="text-6xl font-bold text-wordle-gray-light">404</h1>
                <h2 className="text-3xl font-semibold mt-4">Page Not Found</h2>
                <p className="text-gray-400 mt-2">The page you're looking for doesn't exist or has been moved.</p>
                <Link to="/" className="mt-6 inline-block bg-wordle-green text-white font-bold py-2 px-6 rounded-md hover:bg-green-600 transition duration-200">
                    Go Home
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;

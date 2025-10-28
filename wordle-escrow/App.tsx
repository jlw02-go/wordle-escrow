import React from 'react';
// FIX: Use namespace import for react-router-dom to resolve potential module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import HomePage from './pages/HomePage';
import GroupPage from './pages/GroupPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import FirebaseWrapper from './components/FirebaseWrapper';

const { BrowserRouter, Routes, Route } = ReactRouterDOM;

const App: React.FC = () => {
  return (
    <FirebaseWrapper>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/group/:groupId" element={<GroupPage />} />
          <Route path="/group/:groupId/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </FirebaseWrapper>
  );
};

export default App;

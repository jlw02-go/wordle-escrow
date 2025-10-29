// App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import GroupPage from "./pages/GroupPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import FirebaseWrapper from "./components/FirebaseWrapper";

import { logFirebaseEnv } from "./debugFirebase";
// Optional: uncomment after you add devTest.ts per my earlier message
// import { testWriteOnce } from "./devTest";

const App: React.FC = () => {
  useEffect(() => {
    // Print the Firebase env values to the browser console (non-secret)
    logFirebaseEnv();
    // Optional: proves Firestore writes work; comment out after testing
    // testWriteOnce().catch(console.error);
  }, []);

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

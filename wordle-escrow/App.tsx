// App.tsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import GroupPage from "./pages/GroupPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import FirebaseWrapper from "./components/FirebaseWrapper";

import { logFirebaseEnv } from "./debugFirebase";
import { testWriteOnce } from "./devTest"; // remove after connectivity is confirmed

const App: React.FC = () => {
  useEffect(() => {
    // Non-secret runtime check of your env values
    logFirebaseEnv();

    // One-time Firestore connectivity test (logs success or the exact error code)
    testWriteOnce().catch(console.error);
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

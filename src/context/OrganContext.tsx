import React, { createContext, useContext, useEffect, useState } from 'react';
import { Organs, initOrgans } from '../../microfixd/langgraph/organs';

const OrganContext = createContext<Organs | null>(null);

export const OrganProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organs, setOrgans] = useState<Organs | null>(null);

  useEffect(() => {
    const initializedOrgans = initOrgans();
    
    // Start non-intrusive autonomous loops
    initializedOrgans.scheduler.start();
    initializedOrgans.loop.start();
    initializedOrgans.mission.start();
    initializedOrgans.feedback.start();
    initializedOrgans.federation.start();
    initializedOrgans.emotion.start();
    initializedOrgans.reflex.start();
    initializedOrgans.web.start();
    
    // Auditory organs require user gesture - DO NOT start automatically
    // initializedOrgans.voice.start();
    // initializedOrgans.voiceEmotion.start();

    setOrgans(initializedOrgans);
    
    return () => {
      // Cleanup if needed (though OS organs usually run indefinitely)
    };
  }, []);

  if (!organs) {
    return (
      <div className="fixed inset-0 bg-[#020509] flex items-center justify-center font-mono text-cyan-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <div className="tracking-[0.2em] animate-pulse">SYNCHRONIZING ORGANS...</div>
        </div>
      </div>
    );
  }

  return (
    <OrganContext.Provider value={organs}>
      {children}
    </OrganContext.Provider>
  );
};

export const useOrgans = () => {
  const context = useContext(OrganContext);
  if (!context) {
    throw new Error('useOrgans must be used within an OrganProvider');
  }
  return context;
};

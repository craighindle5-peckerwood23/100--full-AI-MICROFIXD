import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useOrgans } from '../../context/OrganContext';

export default function MicrofyxdUI() {
  const organs = useOrgans();
  const [metrics, setMetrics] = useState<any>({});
  const [emotion, setEmotion] = useState('STABLE');
  const [missions, setMissions] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [reflexEvents, setReflexEvents] = useState<any[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [sensorsActive, setSensorsActive] = useState(false);

  // UI IS READ-ONLY - POLLS STATE OR SUBSCRIBES TO WIRING
  useEffect(() => {
    const updateState = () => {
      // @ts-ignore
      const m = organs.loop['telemetry'].getLatestMetrics();
      setMetrics({
        cpu: m.cpu,
        memory: m.memory,
        schedulerTick: organs.scheduler['nextTick'] || 0,
        loopCycle: organs.loop['lastCycleTime'] || 0
      });
      setEmotion(organs.emotion.getCurrentEmotion());
      setMissions(organs.mission.getMissions());
      // @ts-ignore
      setAgents(organs.router.getAgents ? organs.router.getAgents() : []);
      // @ts-ignore
      setSensorsActive(organs.voice.running);
    };

    const interval = setInterval(updateState, 500);
    
    const unsubReflex = organs.wiring.on('reflex', (event: any) => {
      setReflexEvents(prev => [event, ...prev].slice(0, 5));
    });

    const unsubVoice = organs.wiring.on('voice', (event: any) => {
      if (event.transcript) setVoiceTranscript(event.transcript);
    });

    return () => {
      clearInterval(interval);
      unsubReflex();
      unsubVoice();
    };
  }, [organs]);

  return (
    <div className="microfyxd-ui">
      <style>{`
        .microfyxd-ui {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100vh;
          background: #0a0f1c;
          color: #e6e9f0;
          font-family: "Inter", sans-serif;
          overflow: hidden;
        }
        .boot-strip-section {
          width: 100%;
          padding: 20px 30px;
          background: linear-gradient(90deg, #0f1628, #1a2340);
          border-bottom: 1px solid #1f2a45;
          display: flex;
          gap: 10px;
        }
        .boot-stage {
          display: inline-block;
          padding: 10px 15px;
          background: #131a2c;
          border-radius: 6px;
          border: 1px solid #1f2a45;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .ai-core-section {
          display: flex;
          justify-content: center;
          padding: 40px 0;
          background: #0d1424;
          border-bottom: 1px solid #1f2a45;
        }
        .ai-core {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ai-head-visual {
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, #3b4bff, #1a1f3f);
          border-radius: 50%;
          box-shadow: 0 0 40px #3b4bff;
          margin-bottom: 20px;
        }
        .ai-stats {
          display: grid;
          grid-template-columns: repeat(2, auto);
          gap: 10px 40px;
          font-size: 14px;
          color: #9bb3ff;
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          padding: 30px;
          flex: 1;
          min-height: 0;
        }
        .left-column, .right-column {
          display: flex;
          flex-direction: column;
          gap: 25px;
          min-height: 0;
        }
        .panel {
          background: #131a2c;
          border: 1px solid #1f2a45;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .panel h2 {
          margin: 0;
          margin-bottom: 5px;
          font-size: 16px;
          color: #9bb3ff;
          text-transform: uppercase;
          letter-spacing: 2px;
          border-bottom: 1px solid #1f2a45;
          padding-bottom: 5px;
        }
        .mission-health {
          font-size: 24px;
          font-weight: 700;
          color: #4d6cff;
        }
        .agent-row, .env-row, .workflow-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #1f2a45;
          font-size: 12px;
        }
        .infrastructure div {
          margin: 6px 0;
          font-size: 13px;
        }
        .quick-actions button {
          display: block;
          width: 100%;
          margin-bottom: 10px;
          padding: 10px;
          background: #1a2340;
          border: 1px solid #2a3a60;
          border-radius: 6px;
          color: #e6e9f0;
          cursor: pointer;
          transition: background 0.2s;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 1px;
        }
        .quick-actions button:hover {
          background: #2a3a60;
        }
        .scroll-area {
          flex: 1;
          overflow-y: auto;
        }
      `}</style>

      {/* BOOT & EMERGENCE STRIP */}
      <section className="boot-strip-section">
        <div className="boot-stage">BOOT_SEQUENCE: ONLINE</div>
        <div className="boot-stage">NEURAL_INIT: COMPLETE</div>
        <div className="boot-stage">ORBIT_REVEAL: ACTIVE</div>
      </section>

      {/* AI INTELLIGENCE CORE */}
      <section className="ai-core-section">
        <div className="ai-core">
          <motion.div 
            animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="ai-head-visual" 
          />
          <div className="ai-stats">
            <div>EMOTION_VECT: {emotion}</div>
            <div>COGNITIVE_LOAD: {Math.round((metrics.cpu || 0) * 100)}%</div>
            <div>MEM_RESERVE: {Math.round((metrics.memory || 0) * 100)}%</div>
            <div>NEURAL_TICK: {metrics.schedulerTick}</div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <main className="main-grid">
        {/* LEFT COLUMN */}
        <div className="left-column">
          {/* Mission Control Panel */}
          <section className="panel mission-control">
            <h2>Mission Control</h2>
            <div className="scroll-area">
              {missions.map(m => (
                <div key={m.id} className="agent-row">
                  <span className="mission-health">{m.id}</span>
                  <span style={{ color: '#4d6cff' }}>{m.state.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Organ Health Panel */}
          <section className="panel organ-health">
            <h2>Organ Health</h2>
            <div className="scroll-area">
              {['Repair', 'Deploy', 'Reflex', 'Federation'].map(org => (
                <div key={org} className="agent-row">
                  <span>{org}</span>
                  <span style={{ color: '#4ade80' }}>NOMINAL</span>
                </div>
              ))}
            </div>
          </section>

          {/* Voice Panel */}
          <section className="panel voice">
            <h2>Voice Console</h2>
            <div className="scroll-area" style={{ fontStyle: 'italic', opacity: 0.8 }}>
              {voiceTranscript || "Listening..."}
            </div>
            {!sensorsActive && (
              <button 
                onClick={() => organs.wiring.broadcast('voice', { type: 'start_sensors' })}
                style={{ padding: '8px', background: '#3b4bff', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '11px' }}
              >
                SYNC_SENSORS
              </button>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="right-column">
          {/* System Infrastructure Panel */}
          <section className="panel infrastructure">
            <h2>Infrastructure</h2>
            <div className="scroll-area">
              <div>SCHEDULER_TICK: {metrics.schedulerTick}</div>
              <div>LOOP_CYCLE: {metrics.loopCycle}</div>
              <div>WIRING_EVENT_LAST: STABLE</div>
              {reflexEvents.slice(0, 3).map((e, i) => (
                <div key={i} style={{ color: '#ff4d4d', fontSize: '10px' }}>REFLEX_ALERT: {e.type}</div>
              ))}
            </div>
          </section>

          {/* Quick Actions Panel */}
          <section className="panel quick-actions">
            <h2>Quick Actions</h2>
            <div className="scroll-area">
              <button onClick={() => organs.wiring.broadcast('mission', { type: 'accelerate' })}>Mission Accelerate</button>
              <button onClick={() => organs.wiring.broadcast('federation', { type: 'node_ping' })}>Federation Ping</button>
              <button onClick={() => organs.wiring.broadcast('web', { type: 'navigate', url: 'https://google.com' })}>Web Navigate</button>
            </div>
          </section>

          {/* Emotion Panel */}
          <section className="panel emotion">
            <h2>Emotion State</h2>
            <div className="scroll-area" style={{ display: 'flex', gap: '5px' }}>
              {['calm', 'focused', 'urgent'].map(e => (
                <button 
                  key={e} 
                  onClick={() => organs.wiring.broadcast('emotion', { type: 'voice_modulation', emotion: e })}
                  style={{ flex: 1, padding: '5px', background: '#1a2340', border: '1px solid #1f2a45', color: '#9bb3ff', fontSize: '10px', cursor: 'pointer' }}
                >
                  {e.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

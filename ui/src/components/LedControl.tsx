'use client';

import { useState, useEffect } from 'react';
import { Bot, CheckCircle2, Cpu, Lightbulb, Power, Radio, Shield, Sparkles, Zap, Activity } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ledStatesAtom, ledWebSocketConnectedAtom } from '@/lib/atoms';
import { useLedWebSocket } from '@/lib/useLedWebSocket';

interface LedControlProps {
  onStateChange?: () => void;
}

export function LedControl({ onStateChange }: LedControlProps) {
  // Access LED state from Jotai global state
  const ledStates = useAtomValue(ledStatesAtom);
  const isConnected = useAtomValue(ledWebSocketConnectedAtom);

  // Get WebSocket send methods & hardware diagnostic info
  const { sendControlCommand, sendPresetCommand, hardwareInfo } = useLedWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoModeLoading, setIsAutoModeLoading] = useState(false);

  // Fetch initial Auto Mode state from backend
  useEffect(() => {
    const fetchAutoMode = async () => {
      try {
        const res = await fetch('/api/led/lamp/auto');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.auto_mode === 'boolean') {
            setIsAutoMode(data.auto_mode);
          }
        }
      } catch (err) {
        console.error('Failed to fetch lamp auto mode:', err);
      }
    };
    fetchAutoMode();
  }, []);

  const handleToggleAutoMode = async () => {
    setIsAutoModeLoading(true);
    try {
      const targetVal = !isAutoMode;
      const res = await fetch('/api/led/lamp/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsAutoMode(data.auto_mode);
        if (data.auto_mode) {
          toast.success('🤖 [AUTONOMOUS MODE]: Automated sensor triggers active');
        } else {
          toast.info('🔒 [MANUAL/AI EXCLUSIVE]: Sensor override locked');
        }
      } else {
        toast.error('Failed to toggle Auto Mode');
      }
    } catch {
      toast.error('Error connecting to backend for Auto Mode');
    } finally {
      setIsAutoModeLoading(false);
    }
  };

  const handleControl = async (color: 'red' | 'yellow' | 'green' | 'lamp' | 'all', action: 'ON' | 'OFF' | 'TOGGLE') => {
    if (!isConnected) {
      toast.error('Not connected to hardware service');
      return;
    }
    setIsLoading(true);
    try {
      const success = await sendControlCommand(color, action);
      if (success) {
        const targetName = color === 'lamp' ? 'LAMP_RELAY' : `${color.toUpperCase()}_LED`;
        const hwTag = hardwareInfo?.is_hardware_active ? '⚡ [GPIO_VERIFIED]' : '📋 [SIMULATED]';
        toast.success(`${targetName} => ${action} ${hwTag}`);
        if (onStateChange) onStateChange();
      } else {
        toast.error('Failed to send hardware command');
      }
    } catch {
      toast.error('Failed to update hardware');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreset = async (mode: 'red' | 'yellow' | 'green' | 'off' | 'all') => {
    if (!isConnected) {
      toast.error('Not connected to hardware service');
      return;
    }

    setIsLoading(true);
    try {
      const success = await sendPresetCommand(mode);
      if (success) {
        toast.success(`PRESET APPLIED: [${mode.toUpperCase()}]`);
        if (onStateChange) onStateChange();
      } else {
        toast.error('Failed to send preset');
      }
    } catch {
      toast.error('Failed to set preset');
    } finally {
      setIsLoading(false);
    }
  };

  const isRedOn = ledStates.red === 'ON';
  const isYellowOn = ledStates.yellow === 'ON';
  const isGreenOn = ledStates.green === 'ON';
  const isLampOn = ledStates.lamp === 'ON';
  const anyOn = isRedOn || isYellowOn || isGreenOn || isLampOn;
  const isHwActive = hardwareInfo?.is_hardware_active ?? false;

  return (
    <div className="hud-panel p-3 sm:p-4 rounded-sm relative overflow-hidden">
      {/* Sci-Fi Background Glows */}
      {isRedOn && <div className="absolute -left-10 -top-10 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />}
      {isYellowOn && <div className="absolute left-1/4 -top-10 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />}
      {isGreenOn && <div className="absolute left-2/4 -top-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />}
      {isLampOn && <div className="absolute -right-10 -top-10 w-48 h-48 bg-cyan-400/25 rounded-full blur-3xl pointer-events-none" />}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-cyan-500/30 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-sm bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-widest font-heading text-cyan-300 hud-glow-cyan">
                HARDWARE_ACTUATOR_MATRIX
              </h2>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400/40 text-cyan-200">
                CHIP: {hardwareInfo?.gpio_chip || '/dev/gpiochip0'}
              </span>
            </div>
            <p className="text-[10px] text-cyan-400/70 font-mono">DIRECT PIN VERIFICATION & LOAD RELAY DIAGNOSTICS</p>
          </div>
        </div>

        {/* Hardware Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-sm text-[10px] font-mono flex items-center gap-1.5 border ${
            isHwActive 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
              : 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
          }`}>
            <Cpu className="w-3 h-3" />
            <span className="font-bold tracking-wider">{isHwActive ? 'GPIO_HARDWARE_LOCKED' : 'EMULATED_GPIO'}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isHwActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          </div>
        </div>
      </div>

      {/* 4 Actuator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* RED LED */}
        <div className={`p-3 rounded-sm border transition-all duration-300 relative overflow-hidden ${
          isRedOn 
            ? 'bg-rose-950/50 border-rose-500/80 hud-glow-box-rose' 
            : 'bg-cyan-950/20 border-cyan-500/25 hover:border-cyan-500/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                isRedOn ? 'bg-rose-500 shadow-[0_0_14px_#f43f5e] animate-pulse' : 'bg-rose-950 border border-rose-800/60'
              }`} />
              <div>
                <h4 className="text-[11px] font-bold tracking-wider text-rose-300 font-mono">RED_BEACON</h4>
                <div className="text-[9px] text-cyan-500/70 font-mono">PIN_{hardwareInfo?.pins?.red?.board_pin ?? 11} (GPIO_{hardwareInfo?.pins?.red?.gpio ?? 17})</div>
              </div>
            </div>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${
              isRedOn ? 'bg-rose-500/30 text-rose-200 border-rose-500' : 'bg-cyan-950/60 text-cyan-600 border-cyan-800/40'
            }`}>
              {ledStates.red}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('red', 'TOGGLE')}
            className={`w-full text-[11px] h-7 font-mono font-bold tracking-wider rounded-xs transition-all ${
              isRedOn 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_10px_rgba(244,63,94,0.6)]' 
                : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400'
            }`}
          >
            <Power className="w-3 h-3 mr-1" />
            {isRedOn ? 'DISENGAGE' : 'ENGAGE'}
          </Button>
        </div>

        {/* YELLOW LED */}
        <div className={`p-3 rounded-sm border transition-all duration-300 relative overflow-hidden ${
          isYellowOn 
            ? 'bg-amber-950/50 border-amber-500/80 hud-glow-box-amber' 
            : 'bg-cyan-950/20 border-cyan-500/25 hover:border-cyan-500/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                isYellowOn ? 'bg-amber-400 shadow-[0_0_14px_#fbbf24] animate-pulse' : 'bg-amber-950 border border-amber-800/60'
              }`} />
              <div>
                <h4 className="text-[11px] font-bold tracking-wider text-amber-300 font-mono">YELLOW_BEACON</h4>
                <div className="text-[9px] text-cyan-500/70 font-mono">PIN_{hardwareInfo?.pins?.yellow?.board_pin ?? 15} (GPIO_{hardwareInfo?.pins?.yellow?.gpio ?? 22})</div>
              </div>
            </div>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${
              isYellowOn ? 'bg-amber-500/30 text-amber-200 border-amber-500' : 'bg-cyan-950/60 text-cyan-600 border-cyan-800/40'
            }`}>
              {ledStates.yellow}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('yellow', 'TOGGLE')}
            className={`w-full text-[11px] h-7 font-mono font-bold tracking-wider rounded-xs transition-all ${
              isYellowOn 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.6)]' 
                : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400'
            }`}
          >
            <Power className="w-3 h-3 mr-1" />
            {isYellowOn ? 'DISENGAGE' : 'ENGAGE'}
          </Button>
        </div>

        {/* GREEN LED */}
        <div className={`p-3 rounded-sm border transition-all duration-300 relative overflow-hidden ${
          isGreenOn 
            ? 'bg-emerald-950/50 border-emerald-500/80 hud-glow-box-emerald' 
            : 'bg-cyan-950/20 border-cyan-500/25 hover:border-cyan-500/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                isGreenOn ? 'bg-emerald-400 shadow-[0_0_14px_#10b981] animate-pulse' : 'bg-emerald-950 border border-emerald-800/60'
              }`} />
              <div>
                <h4 className="text-[11px] font-bold tracking-wider text-emerald-300 font-mono">GREEN_BEACON</h4>
                <div className="text-[9px] text-cyan-500/70 font-mono">PIN_{hardwareInfo?.pins?.green?.board_pin ?? 16} (GPIO_{hardwareInfo?.pins?.green?.gpio ?? 23})</div>
              </div>
            </div>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${
              isGreenOn ? 'bg-emerald-500/30 text-emerald-200 border-emerald-500' : 'bg-cyan-950/60 text-cyan-600 border-cyan-800/40'
            }`}>
              {ledStates.green}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('green', 'TOGGLE')}
            className={`w-full text-[11px] h-7 font-mono font-bold tracking-wider rounded-xs transition-all ${
              isGreenOn 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.6)]' 
                : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400'
            }`}
          >
            <Power className="w-3 h-3 mr-1" />
            {isGreenOn ? 'DISENGAGE' : 'ENGAGE'}
          </Button>
        </div>

        {/* LAMP RELAY */}
        <div className={`p-3 rounded-sm border transition-all duration-300 relative overflow-hidden ${
          isLampOn 
            ? 'bg-cyan-950/70 border-cyan-400 hud-glow-box-cyan' 
            : 'bg-cyan-950/20 border-cyan-500/25 hover:border-cyan-500/50'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                isLampOn ? 'bg-cyan-400 shadow-[0_0_14px_#00f0ff] animate-pulse' : 'bg-cyan-950 border border-cyan-800/60'
              }`} />
              <div>
                <h4 className="text-[11px] font-bold tracking-wider text-cyan-200 font-mono flex items-center gap-1">
                  <span>RELAY_220V</span>
                  <Zap className="w-3 h-3 text-cyan-400" />
                </h4>
                <div className="text-[9px] text-cyan-500/70 font-mono">PIN_{hardwareInfo?.pins?.lamp?.board_pin ?? 13} (GPIO_{hardwareInfo?.pins?.lamp?.gpio ?? 27})</div>
              </div>
            </div>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${
              isLampOn ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400' : 'bg-cyan-950/60 text-cyan-600 border-cyan-800/40'
            }`}>
              {ledStates.lamp}
            </span>
          </div>

          <div className="space-y-1.5">
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() => handleControl('lamp', 'TOGGLE')}
              className={`w-full text-[11px] h-7 font-mono font-bold tracking-wider rounded-xs transition-all ${
                isLampOn 
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.7)]' 
                  : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400'
              }`}
            >
              <Power className="w-3 h-3 mr-1" />
              {isLampOn ? 'DISENGAGE' : 'ENGAGE'}
            </Button>

            {/* Lamp Auto Mode Toggle Badge */}
            <button
              type="button"
              onClick={handleToggleAutoMode}
              disabled={isAutoModeLoading}
              className={`w-full text-[9px] font-mono py-1 px-1.5 rounded-xs flex items-center justify-between border transition-all ${
                isAutoMode
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'bg-cyan-950/40 text-cyan-500/80 border-cyan-800/40 hover:border-cyan-500/50'
              }`}
            >
              <div className="flex items-center gap-1">
                {isAutoMode ? <Bot className="w-2.5 h-2.5 text-emerald-400" /> : <Shield className="w-2.5 h-2.5 text-cyan-600" />}
                <span>AUTO_TRIGGERS:</span>
              </div>
              <span className="font-bold">{isAutoMode ? '[ENABLED]' : '[AI_ONLY]'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preset Control Ribbon */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2.5 mt-3 border-t border-cyan-500/30 font-mono text-[10px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-cyan-400/80 flex items-center gap-1 font-bold">
            <Radio className="w-3 h-3 text-cyan-400" /> PRESETS:
          </span>
          <button
            onClick={() => handlePreset('red')}
            disabled={isLoading}
            className="px-2 py-0.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 hover:border-rose-500 rounded-xs transition-all"
          >
            [01] STOP_HALT
          </button>
          <button
            onClick={() => handlePreset('yellow')}
            disabled={isLoading}
            className="px-2 py-0.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 hover:border-amber-500 rounded-xs transition-all"
          >
            [02] CAUTION_WARN
          </button>
          <button
            onClick={() => handlePreset('green')}
            disabled={isLoading}
            className="px-2 py-0.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 hover:border-emerald-500 rounded-xs transition-all"
          >
            [03] ENGAGE_ALL_CLEAR
          </button>
        </div>

        {anyOn && (
          <button
            onClick={() => handlePreset('off')}
            disabled={isLoading}
            className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold border border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)] rounded-xs flex items-center justify-center gap-1 transition-all"
          >
            <Power className="w-3 h-3" /> MASTER_PURGE_OFF
          </button>
        )}
      </div>
    </div>
  );
}

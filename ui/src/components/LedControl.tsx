'use client';

import { useState, useEffect } from 'react';
import { Bot, Cpu, Lightbulb, Power, Shield, Activity, Sparkles, Sliders } from 'lucide-react';
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
          toast.success('Auto Mode: Sensor triggers enabled');
        } else {
          toast.info('Manual Mode: Sensor override disabled');
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
        const label = color === 'lamp' ? 'Desk Lamp' : `${color.charAt(0).toUpperCase() + color.slice(1)} Light`;
        toast.success(`${label} turned ${action === 'TOGGLE' ? 'toggled' : action.toLowerCase()}`);
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
        toast.success(`Preset applied: ${mode.toUpperCase()}`);
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
    <div className="bg-[#202020] border border-[#2e2e2e] rounded-lg p-3 sm:p-4 text-[#e3e2de]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-[#2e2e2e] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#282828] border border-[#333333] flex items-center justify-center text-sm select-none">
            💡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#ecebed]">
                Physical Devices & Lights
              </h2>
              <span className="text-[11px] px-1.5 py-0.5 bg-[#262626] border border-[#333333] text-[#9b9a97] rounded-md font-mono">
                {hardwareInfo?.gpio_chip || '/dev/gpiochip0'}
              </span>
            </div>
            <p className="text-xs text-[#8f8e8a]">Real-time state and pin controls</p>
          </div>
        </div>

        {/* Hardware Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 border font-medium ${
            isHwActive 
              ? 'bg-[#1e2920] text-[#81c784] border-[#2e4030]' 
              : 'bg-[#29241e] text-[#fbbf24] border-[#403628]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isHwActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{isHwActive ? 'Hardware Verified' : 'Simulated Mode'}</span>
          </div>
        </div>
      </div>

      {/* 4 Device Cards (Notion Gallery Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* RED LIGHT */}
        <div className={`p-3 rounded-lg border transition-all ${
          isRedOn 
            ? 'bg-[#261e1e] border-[#502828]' 
            : 'bg-[#242424] border-[#2e2e2e] hover:border-[#383838]'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                isRedOn ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]' : 'bg-[#3a3a3a]'
              }`} />
              <div>
                <h4 className="text-xs font-medium text-[#ecebed]">Red Light</h4>
                <div className="text-[11px] text-[#8f8e8a] font-mono">Pin 11 • GPIO 17</div>
              </div>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
              isRedOn 
                ? 'bg-[#3b1d1d] text-[#f87171] border-[#5c2a2a]' 
                : 'bg-[#2a2a2a] text-[#787774] border-[#333333]'
            }`}>
              {ledStates.red}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('red', 'TOGGLE')}
            className={`w-full text-xs h-7.5 rounded-md transition-all font-medium ${
              isRedOn 
                ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#ecebed] border border-[#333333]'
            }`}
          >
            <Power className="w-3 h-3 mr-1.5" />
            {isRedOn ? 'Turn Off' : 'Turn On'}
          </Button>
        </div>

        {/* YELLOW LIGHT */}
        <div className={`p-3 rounded-lg border transition-all ${
          isYellowOn 
            ? 'bg-[#27231c] border-[#4d3e26]' 
            : 'bg-[#242424] border-[#2e2e2e] hover:border-[#383838]'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                isYellowOn ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]' : 'bg-[#3a3a3a]'
              }`} />
              <div>
                <h4 className="text-xs font-medium text-[#ecebed]">Yellow Light</h4>
                <div className="text-[11px] text-[#8f8e8a] font-mono">Pin 15 • GPIO 22</div>
              </div>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
              isYellowOn 
                ? 'bg-[#3b321c] text-[#fbbf24] border-[#544422]' 
                : 'bg-[#2a2a2a] text-[#787774] border-[#333333]'
            }`}>
              {ledStates.yellow}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('yellow', 'TOGGLE')}
            className={`w-full text-xs h-7.5 rounded-md transition-all font-medium ${
              isYellowOn 
                ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#ecebed] border border-[#333333]'
            }`}
          >
            <Power className="w-3 h-3 mr-1.5" />
            {isYellowOn ? 'Turn Off' : 'Turn On'}
          </Button>
        </div>

        {/* GREEN LIGHT */}
        <div className={`p-3 rounded-lg border transition-all ${
          isGreenOn 
            ? 'bg-[#1c261e] border-[#2a4d30]' 
            : 'bg-[#242424] border-[#2e2e2e] hover:border-[#383838]'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                isGreenOn ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-[#3a3a3a]'
              }`} />
              <div>
                <h4 className="text-xs font-medium text-[#ecebed]">Green Light</h4>
                <div className="text-[11px] text-[#8f8e8a] font-mono">Pin 16 • GPIO 23</div>
              </div>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
              isGreenOn 
                ? 'bg-[#1d3823] text-[#81c784] border-[#2b5434]' 
                : 'bg-[#2a2a2a] text-[#787774] border-[#333333]'
            }`}>
              {ledStates.green}
            </span>
          </div>
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => handleControl('green', 'TOGGLE')}
            className={`w-full text-xs h-7.5 rounded-md transition-all font-medium ${
              isGreenOn 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#ecebed] border border-[#333333]'
            }`}
          >
            <Power className="w-3 h-3 mr-1.5" />
            {isGreenOn ? 'Turn Off' : 'Turn On'}
          </Button>
        </div>

        {/* DESK LAMP RELAY */}
        <div className={`p-3 rounded-lg border transition-all ${
          isLampOn 
            ? 'bg-[#1b252b] border-[#254659]' 
            : 'bg-[#242424] border-[#2e2e2e] hover:border-[#383838]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                isLampOn ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]' : 'bg-[#3a3a3a]'
              }`} />
              <div>
                <h4 className="text-xs font-medium text-[#ecebed] flex items-center gap-1">
                  <span>Desk Lamp</span>
                  <Lightbulb className="w-3 h-3 text-[#9b9a97]" />
                </h4>
                <div className="text-[11px] text-[#8f8e8a] font-mono">Pin 13 • GPIO 27</div>
              </div>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
              isLampOn 
                ? 'bg-[#1d3542] text-[#38bdf8] border-[#2a4e61]' 
                : 'bg-[#2a2a2a] text-[#787774] border-[#333333]'
            }`}>
              {ledStates.lamp}
            </span>
          </div>

          <div className="space-y-1.5">
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() => handleControl('lamp', 'TOGGLE')}
              className={`w-full text-xs h-7.5 rounded-md transition-all font-medium ${
                isLampOn 
                  ? 'bg-sky-600 hover:bg-sky-700 text-white' 
                  : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#ecebed] border border-[#333333]'
              }`}
            >
              <Power className="w-3 h-3 mr-1.5" />
              {isLampOn ? 'Turn Off' : 'Turn On'}
            </Button>

            {/* Lamp Auto Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleAutoMode}
              disabled={isAutoModeLoading}
              className={`w-full text-[11px] py-1 px-2 rounded-md flex items-center justify-between border transition-all ${
                isAutoMode
                  ? 'bg-[#1e2920] text-[#81c784] border-[#2e4030]'
                  : 'bg-[#262626] text-[#8f8e8a] border-[#333333] hover:bg-[#2c2c2c]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3 h-3" />
                <span>Auto Trigger</span>
              </span>
              <span className="font-semibold text-[10px]">{isAutoMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Presets Bar (Notion Filter Pills) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 mt-3 border-t border-[#2e2e2e] text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[#8f8e8a] font-medium mr-1">Presets:</span>
          <button
            onClick={() => handlePreset('red')}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[#262626] hover:bg-[#2e2e2e] text-[#ecebed] border border-[#333333] hover:border-[#404040] rounded-md transition-colors flex items-center gap-1"
          >
            <span>🔴</span> Red Stop
          </button>
          <button
            onClick={() => handlePreset('yellow')}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[#262626] hover:bg-[#2e2e2e] text-[#ecebed] border border-[#333333] hover:border-[#404040] rounded-md transition-colors flex items-center gap-1"
          >
            <span>🟡</span> Yellow Caution
          </button>
          <button
            onClick={() => handlePreset('green')}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[#262626] hover:bg-[#2e2e2e] text-[#ecebed] border border-[#333333] hover:border-[#404040] rounded-md transition-colors flex items-center gap-1"
          >
            <span>🟢</span> Green Go
          </button>
        </div>

        {anyOn && (
          <button
            onClick={() => handlePreset('off')}
            disabled={isLoading}
            className="px-2.5 py-1 bg-[#2c1d1d] hover:bg-[#382222] text-[#f87171] border border-[#4d2828] rounded-md flex items-center justify-center gap-1.5 transition-colors font-medium"
          >
            <Power className="w-3 h-3" /> Turn All Off
          </button>
        )}
      </div>
    </div>
  );
}

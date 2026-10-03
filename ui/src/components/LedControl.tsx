'use client';

import { useState, useEffect } from 'react';
import { Bot, CheckCircle2, Cpu, Lightbulb, Power, Radio, Shield, Sparkles, Zap } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
          toast.success('🤖 Lamp Auto Mode ENABLED: Automated triggers active');
        } else {
          toast.info('🔒 Lamp Auto Mode DISABLED: Only AI Agent / Manual commands allowed');
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
        const targetName = color === 'lamp' ? 'Lamp Relay' : `${color.toUpperCase()} LED`;
        const hwTag = hardwareInfo?.is_hardware_active ? '⚡ [GPIO Pin Verified]' : '📋 [Simulated]';
        toast.success(`${targetName} ${action} ${hwTag}`);
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
        toast.success(`Preset: ${mode.toUpperCase()}`);
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
    <Card className="border-border bg-card/70 backdrop-blur-md overflow-hidden relative shadow-sm">
      {/* Visual Ambient Glow based on active outputs */}
      {isRedOn && <div className="absolute -left-12 -top-12 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />}
      {isYellowOn && <div className="absolute left-1/4 -top-12 w-48 h-48 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />}
      {isGreenOn && <div className="absolute left-2/4 -top-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />}
      {isLampOn && <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />}

      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between   gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold">Hardware Controller</CardTitle>
            <p className="text-[11px] text-muted-foreground">Direct GPIO Pin & Relay Diagnostics</p>
          </div>
        </div>

        {/* Physical GPIO Hardware Diagnostic Badge */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className={`px-2.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 border ${isHwActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`}>
            <Cpu className="w-3 h-3" />
            <span>{isHwActive ? 'Hardware Active (gpiod)' : 'Simulated GPIO'}</span>
            {isHwActive && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* 4 Hardware Output Controllers (3 Traffic LEDs + 1 Lamp Relay) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* RED LED */}
          <div className={`p-3.5 rounded-xl border transition-all duration-200 ${isRedOn ? 'bg-rose-500/10 border-rose-500/40 shadow-xs' : 'bg-muted/40 border-border'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isRedOn ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse' : 'bg-rose-950/60 border border-rose-800/40'}`} />
                <div>
                  <h4 className="text-xs font-bold text-foreground">RED LED</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Pin {hardwareInfo?.pins?.red?.board_pin ?? 11} (GPIO {hardwareInfo?.pins?.red?.gpio ?? 17})
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isRedOn ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {ledStates.red}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={isRedOn ? 'destructive' : 'outline'}
                disabled={isLoading}
                onClick={() => handleControl('red', 'TOGGLE')}
                className="w-full text-xs h-7.5 gap-1.5 font-medium"
              >
                <Power className="w-3 h-3" />
                {isRedOn ? 'Turn OFF' : 'Turn ON'}
              </Button>
            </div>
          </div>

          {/* YELLOW LED */}
          <div className={`p-3.5 rounded-xl border transition-all duration-200 ${isYellowOn ? 'bg-amber-500/10 border-amber-500/40 shadow-xs' : 'bg-muted/40 border-border'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isYellowOn ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse' : 'bg-amber-950/60 border border-amber-800/40'}`} />
                <div>
                  <h4 className="text-xs font-bold text-foreground">YELLOW LED</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Pin {hardwareInfo?.pins?.yellow?.board_pin ?? 15} (GPIO {hardwareInfo?.pins?.yellow?.gpio ?? 22})
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isYellowOn ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {ledStates.yellow}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={isYellowOn ? 'default' : 'outline'}
                disabled={isLoading}
                onClick={() => handleControl('yellow', 'TOGGLE')}
                className={`w-full text-xs h-7.5 gap-1.5 font-medium ${isYellowOn ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-500' : ''}`}
              >
                <Power className="w-3 h-3" />
                {isYellowOn ? 'Turn OFF' : 'Turn ON'}
              </Button>
            </div>
          </div>

          {/* GREEN LED */}
          <div className={`p-3.5 rounded-xl border transition-all duration-200 ${isGreenOn ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs' : 'bg-muted/40 border-border'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isGreenOn ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-pulse' : 'bg-emerald-950/60 border border-emerald-800/40'}`} />
                <div>
                  <h4 className="text-xs font-bold text-foreground">GREEN LED</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Pin {hardwareInfo?.pins?.green?.board_pin ?? 16} (GPIO {hardwareInfo?.pins?.green?.gpio ?? 23})
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isGreenOn ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {ledStates.green}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={isGreenOn ? 'default' : 'outline'}
                disabled={isLoading}
                onClick={() => handleControl('green', 'TOGGLE')}
                className={`w-full text-xs h-7.5 gap-1.5 font-medium ${isGreenOn ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
              >
                <Power className="w-3 h-3" />
                {isGreenOn ? 'Turn OFF' : 'Turn ON'}
              </Button>
            </div>
          </div>

          {/* LAMP RELAY */}
          <div className={`p-3.5 rounded-xl border transition-all duration-200 ${isLampOn ? 'bg-sky-500/10 border-sky-500/40 shadow-xs' : 'bg-muted/40 border-border'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isLampOn ? 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)] animate-pulse' : 'bg-sky-950/60 border border-sky-800/40'}`} />
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span>LAMP RELAY</span>
                    <Zap className="w-3 h-3 text-sky-400" />
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Pin {hardwareInfo?.pins?.lamp?.board_pin ?? 13} (GPIO {hardwareInfo?.pins?.lamp?.gpio ?? 27})
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isLampOn ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {ledStates.lamp}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={isLampOn ? 'default' : 'outline'}
                  disabled={isLoading}
                  onClick={() => handleControl('lamp', 'TOGGLE')}
                  className={`w-full text-xs h-7.5 gap-1.5 font-medium ${isLampOn ? 'bg-sky-600 hover:bg-sky-700 text-white border-sky-500' : ''}`}
                >
                  <Power className="w-3 h-3" />
                  {isLampOn ? 'Turn OFF' : 'Turn ON'}
                </Button>
              </div>

              {/* Lamp Auto Mode Toggle Badge */}
              <button
                type="button"
                onClick={handleToggleAutoMode}
                disabled={isAutoModeLoading}
                title={isAutoMode ? 'Automated triggers (YOLO / endpoints) can switch lamp. Click to disable.' : 'Auto mode is OFF. Only AI Agent or manual clicks can control lamp. Click to enable.'}
                className={`w-full text-[10px] font-mono py-1 px-2 rounded-lg flex items-center justify-between border transition-colors ${
                  isAutoMode
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-muted/80 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-1">
                  {isAutoMode ? <Bot className="w-3 h-3 text-emerald-400" /> : <Shield className="w-3 h-3 text-muted-foreground" />}
                  <span>Auto Mode</span>
                </div>
                <span className="font-bold">{isAutoMode ? 'ACTIVE' : 'OFF (AI-ONLY)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Master & Preset Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/80 text-xs">
          {/* Traffic Light Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Radio className="w-3 h-3 text-primary" /> Presets:
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={isLoading}
              onClick={() => handlePreset('red')}
              className="text-[11px] h-6 px-2 hover:border-rose-500 hover:text-rose-400"
            >
              🔴 Stop (Red)
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={isLoading}
              onClick={() => handlePreset('yellow')}
              className="text-[11px] h-6 px-2 hover:border-amber-500 hover:text-amber-300"
            >
              🟡 Caution (Yellow)
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={isLoading}
              onClick={() => handlePreset('green')}
              className="text-[11px] h-6 px-2 hover:border-emerald-500 hover:text-emerald-400"
            >
              🟢 Go (Green)
            </Button>
          </div>

          {/* Master Turn OFF All */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {anyOn && (
              <Button
                size="xs"
                variant="destructive"
                disabled={isLoading}
                onClick={() => handlePreset('off')}
                className="text-[11px] h-6 px-2.5 font-medium gap-1"
              >
                <Power className="w-3 h-3" /> Turn All OFF
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

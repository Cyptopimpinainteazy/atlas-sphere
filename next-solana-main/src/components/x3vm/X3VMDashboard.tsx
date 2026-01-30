/**
 * X3VM Components for Next.js
 *
 * React components for deploying, executing, and interacting with X3VM programs.
 */

'use client';

import { useState, useCallback } from 'react';
import { useX3VM, useX3ExamplePrograms, X3BytecodeBuilder } from '@/hooks/useX3VM';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

/**
 * Main X3VM Dashboard Component
 */
export function X3VMDashboard() {
  const x3vm = useX3VM();
  const { programs, selectedProgram, setSelectedProgram } = useX3ExamplePrograms();

  const [programName, setProgramName] = useState('');
  const [args, setArgs] = useState<string>('');
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const handleDeploy = useCallback(async () => {
    if (!selectedProgram || !programName) return;

    const program = programs[selectedProgram as keyof typeof programs];
    const address = await x3vm.deployProgram(programName, program.bytecode);
    if (address) {
      setDeployedAddress(address);
    }
  }, [selectedProgram, programName, programs, x3vm]);

  const handleExecute = useCallback(async () => {
    if (!deployedAddress) return;

    const argValues = args
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a)
      .map((a) => BigInt(parseInt(a, 10)));

    await x3vm.executeProgram(deployedAddress, 0, argValues);
  }, [deployedAddress, args, x3vm]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            X3VM - Atlas Sphere Virtual Machine
          </CardTitle>
          <CardDescription>
            Deploy and execute X3 bytecode programs on Solana. X3VM provides deterministic execution
            with EVM/SVM cross-chain capabilities.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="deploy" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="execute">Execute</TabsTrigger>
          <TabsTrigger value="builder">Bytecode Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="deploy">
          <Card>
            <CardHeader>
              <CardTitle>Deploy X3VM Program</CardTitle>
              <CardDescription>Select an example program or upload custom bytecode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Example Programs</Label>
                <Select value={selectedProgram ?? ''} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(programs).map(([key, prog]) => (
                      <SelectItem key={key} value={key}>
                        {prog.name} - {prog.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgram && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold">
                    {programs[selectedProgram as keyof typeof programs].name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {programs[selectedProgram as keyof typeof programs].description}
                  </p>
                  <p className="text-xs mt-2">
                    Bytecode size:{' '}
                    {programs[selectedProgram as keyof typeof programs].bytecode.length} bytes
                  </p>
                  <p className="text-xs">
                    Expected inputs:{' '}
                    {programs[selectedProgram as keyof typeof programs].expectedInputs}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="programName">Program Name</Label>
                <Input
                  id="programName"
                  placeholder="my-x3-program"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                />
              </div>

              <Button
                onClick={handleDeploy}
                disabled={!selectedProgram || !programName || x3vm.isLoading}
                className="w-full"
              >
                {x3vm.isLoading ? 'Deploying...' : 'Deploy Program'}
              </Button>

              {deployedAddress && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    ✓ Program Deployed
                  </p>
                  <p className="text-xs font-mono break-all mt-1">{deployedAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execute">
          <Card>
            <CardHeader>
              <CardTitle>Execute X3VM Program</CardTitle>
              <CardDescription>Run a deployed program with arguments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="programAddress">Program Address</Label>
                <Input
                  id="programAddress"
                  placeholder="Enter program address or use deployed"
                  value={deployedAddress ?? ''}
                  onChange={(e) => setDeployedAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="args">Arguments (comma-separated)</Label>
                <Input
                  id="args"
                  placeholder="42, 7"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                />
              </div>

              <Button
                onClick={handleExecute}
                disabled={!deployedAddress || x3vm.isLoading}
                className="w-full"
              >
                {x3vm.isLoading ? 'Executing...' : 'Execute'}
              </Button>

              {x3vm.lastResult && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Execution Result
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-muted-foreground">Return Value:</span>
                    <span className="font-mono">{x3vm.lastResult.returnValue ?? 'void'}</span>
                    <span className="text-muted-foreground">Gas Used:</span>
                    <span className="font-mono">{x3vm.lastResult.gasUsed}</span>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={x3vm.lastResult.success ? 'default' : 'destructive'}>
                      {x3vm.lastResult.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builder">
          <X3VMBytecodeBuilder />
        </TabsContent>
      </Tabs>

      {x3vm.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{x3vm.error}</p>
          <Button variant="ghost" size="sm" onClick={x3vm.clearError} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Bytecode Builder Component
 */
export function X3VMBytecodeBuilder() {
  const [builder] = useState(() => new X3BytecodeBuilder());
  const [instructions, setInstructions] = useState<string[]>([]);
  const [bytecode, setBytecode] = useState<Uint8Array | null>(null);

  const [selectedOp, setSelectedOp] = useState('addI');
  const [regA, setRegA] = useState('0');
  const [regB, setRegB] = useState('1');
  const [regC, setRegC] = useState('2');
  const [immValue, setImmValue] = useState('0');

  const addInstruction = useCallback(() => {
    const a = parseInt(regA, 10);
    const b = parseInt(regB, 10);
    const c = parseInt(regC, 10);
    const imm = parseInt(immValue, 10);

    let instr = '';

    switch (selectedOp) {
      case 'nop':
        builder.nop();
        instr = 'nop';
        break;
      case 'halt':
        builder.halt();
        instr = 'halt';
        break;
      case 'ret':
        builder.ret(a);
        instr = `ret r${a}`;
        break;
      case 'loadImm':
        builder.loadImm(a, imm);
        instr = `loadImm r${a}, ${imm}`;
        break;
      case 'loadZero':
        builder.loadZero(a);
        instr = `loadZero r${a}`;
        break;
      case 'mov':
        builder.mov(a, b);
        instr = `mov r${a}, r${b}`;
        break;
      case 'addI':
        builder.addI(a, b, c);
        instr = `addI r${a}, r${b}, r${c}`;
        break;
      case 'subI':
        builder.subI(a, b, c);
        instr = `subI r${a}, r${b}, r${c}`;
        break;
      case 'mulI':
        builder.mulI(a, b, c);
        instr = `mulI r${a}, r${b}, r${c}`;
        break;
      case 'divI':
        builder.divI(a, b, c);
        instr = `divI r${a}, r${b}, r${c}`;
        break;
      case 'eqI':
        builder.eqI(a, b, c);
        instr = `eqI r${a}, r${b}, r${c}`;
        break;
      case 'ltI':
        builder.ltI(a, b, c);
        instr = `ltI r${a}, r${b}, r${c}`;
        break;
      case 'gtI':
        builder.gtI(a, b, c);
        instr = `gtI r${a}, r${b}, r${c}`;
        break;
    }

    setInstructions((prev) => [...prev, instr]);
    setBytecode(builder.build());
  }, [builder, selectedOp, regA, regB, regC, immValue]);

  const reset = useCallback(() => {
    setInstructions([]);
    setBytecode(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>X3VM Bytecode Builder</CardTitle>
        <CardDescription>Build X3 bytecode interactively</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instruction</Label>
              <Select value={selectedOp} onValueChange={setSelectedOp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nop">nop</SelectItem>
                  <SelectItem value="halt">halt</SelectItem>
                  <SelectItem value="ret">ret</SelectItem>
                  <SelectItem value="loadImm">loadImm</SelectItem>
                  <SelectItem value="loadZero">loadZero</SelectItem>
                  <SelectItem value="mov">mov</SelectItem>
                  <SelectItem value="addI">addI</SelectItem>
                  <SelectItem value="subI">subI</SelectItem>
                  <SelectItem value="mulI">mulI</SelectItem>
                  <SelectItem value="divI">divI</SelectItem>
                  <SelectItem value="eqI">eqI</SelectItem>
                  <SelectItem value="ltI">ltI</SelectItem>
                  <SelectItem value="gtI">gtI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Reg A</Label>
                <Input value={regA} onChange={(e) => setRegA(e.target.value)} type="number" />
              </div>
              <div>
                <Label>Reg B</Label>
                <Input value={regB} onChange={(e) => setRegB(e.target.value)} type="number" />
              </div>
              <div>
                <Label>Reg C</Label>
                <Input value={regC} onChange={(e) => setRegC(e.target.value)} type="number" />
              </div>
            </div>

            <div>
              <Label>Immediate Value</Label>
              <Input
                value={immValue}
                onChange={(e) => setImmValue(e.target.value)}
                type="number"
                placeholder="For loadImm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={addInstruction} className="flex-1">
                Add Instruction
              </Button>
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Instructions</Label>
              <div className="h-40 overflow-auto p-2 bg-muted rounded-lg font-mono text-xs">
                {instructions.length === 0 ? (
                  <span className="text-muted-foreground">No instructions yet</span>
                ) : (
                  instructions.map((instr, i) => (
                    <div key={i} className="py-0.5">
                      <span className="text-muted-foreground mr-2">{i}:</span>
                      {instr}
                    </div>
                  ))
                )}
              </div>
            </div>

            {bytecode && (
              <div>
                <Label>Bytecode ({bytecode.length} bytes)</Label>
                <div className="h-24 overflow-auto p-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {Array.from(bytecode)
                    .map((b) => b.toString(16).padStart(2, '0'))
                    .join(' ')}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * X3VM Program Card Component
 */
export function X3VMProgramCard({
  program,
  onExecute,
}: {
  program: {
    name: string;
    description: string;
    bytecodeSize: number;
    executionCount: number;
    address?: string;
  };
  onExecute?: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          {program.name}
          {program.executionCount > 0 && (
            <Badge variant="secondary">{program.executionCount} runs</Badge>
          )}
        </CardTitle>
        <CardDescription>{program.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {program.bytecodeSize} bytes
            {program.address && (
              <span className="ml-2 font-mono">{program.address.slice(0, 8)}...</span>
            )}
          </span>
          {onExecute && (
            <Button size="sm" onClick={onExecute}>
              Execute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

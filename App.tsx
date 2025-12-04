import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, ArrowRight, Settings2, Calculator, Save, RefreshCw, BarChart3, PiggyBank, RotateCcw, Trash2, CheckCircle2, CalendarDays } from 'lucide-react';
import { StepCard } from './components/StepCard';
import { Button } from './components/Button';
import { DataTable } from './components/DataTable';
import { LoadingOverlay } from './components/LoadingOverlay';
import { 
  parseExcelFile, 
  identifyColumns, 
  transformToLongFormat, 
  cleanData, 
  pivotData, 
  exportToExcel,
  convertData,
  calculateStatisticsUtil
} from './utils/excelService';
import { LongDataRow, WideDataRow, DateColumn, StatMethod, AppConfig, StatisticsResult } from './types';

function App() {
  // App State
  const [currentStep, setCurrentStep] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Data State
  const [rawData, setRawData] = useState<any[]>([]);
  const [dateCols, setDateCols] = useState<DateColumn[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [longData, setLongData] = useState<LongDataRow[]>([]);
  const [cleanedData, setCleanedData] = useState<LongDataRow[]>([]);
  const [wideData, setWideData] = useState<WideDataRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  
  // Config State
  const [fileName, setFileName] = useState("");
  const [multiplyBy2, setMultiplyBy2] = useState(false);
  const [conversionMode, setConversionMode] = useState<'direct' | 'custom'>('direct');
  const [customFormula, setCustomFormula] = useState("");
  const [statMethod, setStatMethod] = useState<StatMethod>('SUM');
  
  // Stats
  const [summaryStats, setSummaryStats] = useState<StatisticsResult>({ totalPigs: 0, totalVal: 0, avgVal: 0, daysCount: 0 });

  // --- Actions ---

  // STEP 0: Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      setFileName(file.name);
      const { rawData, rawHeaders } = await parseExcelFile(file);
      setRawData(rawData);
      setRawHeaders(rawHeaders);
    } catch (err: any) {
      alert("文件解析失败: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    if (rawData.length > 0 && !window.confirm("确定要清空所有数据并重新开始吗？")) {
      return;
    }
    
    setRawData([]);
    setDateCols([]);
    setRawHeaders([]);
    setLongData([]);
    setCleanedData([]);
    setWideData([]);
    setDates([]);
    setFileName("");
    setMultiplyBy2(false);
    setConversionMode('direct');
    setCustomFormula("");
    setStatMethod('SUM');
    setSummaryStats({ totalPigs: 0, totalVal: 0, avgVal: 0, daysCount: 0 });
    setCurrentStep(0);
    setResetKey(prev => prev + 1);
  }, [rawData.length]);

  const finishStep0 = () => {
    if (rawData.length === 0) return;
    
    // Auto-detect columns
    const { penKey, tagKey, dateCols: detectedDates } = identifyColumns(rawHeaders);
    
    if (!tagKey) {
      alert("错误：未检测到包含'耳标'的列，请检查表头。");
      return;
    }
    if (detectedDates.length === 0) {
      alert("错误：未检测到日期列 (格式如: 料桶刻度10月1日)。");
      return;
    }

    setDateCols(detectedDates);
    const transformed = transformToLongFormat(rawData, penKey, tagKey, detectedDates);
    setLongData(transformed);
    
    setCurrentStep(1);
  };

  // STEP 1: Standardization
  const finishStep1 = () => {
    setCurrentStep(2);
    handleRunCleaning(false); // Default: unchecked
  };

  // STEP 2: Cleaning
  const handleRunCleaning = useCallback((multiply: boolean) => {
    setIsLoading(true);
    // Use timeout to allow UI to render spinner before heavy calc
    setTimeout(() => {
      const result = cleanData(longData, multiply);
      setCleanedData(result);
      setIsLoading(false);
    }, 100);
  }, [longData]);

  const finishStep2 = () => {
    setCurrentStep(3);
    handleRunConversion('direct', '');
  };

  // STEP 3: Conversion
  const handleRunConversion = useCallback((mode: 'direct' | 'custom', formula: string) => {
    if (cleanedData.length === 0) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const converted = convertData(cleanedData, mode, formula);
      setCleanedData(converted);
      setIsLoading(false);
    }, 100);
  }, [cleanedData]);

  const finishStep3 = () => {
    const { wideData: wd, sortedDates } = pivotData(cleanedData, dateCols);
    setWideData(wd);
    setDates(sortedDates);
    setCurrentStep(4);
  };

  // STEP 4: Wide Format
  const finishStep4 = () => {
    // Initial stats with default method
    calculateStatistics('SUM');
    setCurrentStep(5);
  };

  // STEP 5: Statistics
  const calculateStatistics = useCallback((method: StatMethod) => {
     if (wideData.length === 0) return;
     
     setIsLoading(true);
     setTimeout(() => {
        const { updatedWideData, stats } = calculateStatisticsUtil(wideData, dates, method);
        setWideData(updatedWideData);
        setSummaryStats(stats);
        setIsLoading(false);
     }, 100);
  }, [wideData, dates]);

  // Save / Load Config
  const handleSaveConfig = () => {
    const config: AppConfig = {
      multiplyBy2,
      conversionMode,
      customFormula,
      statMethod
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pig-farm-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config: AppConfig = JSON.parse(e.target?.result as string);
        
        // Apply Config
        setMultiplyBy2(config.multiplyBy2);
        setConversionMode(config.conversionMode);
        setCustomFormula(config.customFormula);
        setStatMethod(config.statMethod);

        // Re-run pipeline if data exists
        if (longData.length > 0) {
            setIsLoading(true);
            setTimeout(() => {
                // 1. Clean
                const cleaned = cleanData(longData, config.multiplyBy2);
                setCleanedData(cleaned);
                
                // 2. Convert
                const converted = convertData(cleaned, config.conversionMode, config.customFormula);
                setCleanedData(converted);

                // 3. Pivot
                const { wideData: wd, sortedDates } = pivotData(converted, dateCols);
                setWideData(wd);
                setDates(sortedDates);

                // 4. Stats
                const { updatedWideData, stats } = calculateStatisticsUtil(wd, sortedDates, config.statMethod);
                setWideData(updatedWideData);
                setSummaryStats(stats);
                setIsLoading(false);

                alert("配置已加载并重新计算数据！");
            }, 100);
        } else {
            alert("配置已加载！(上传数据后将应用此配置)");
        }
      } catch (err) {
        alert("配置文件无效");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleDownload = () => {
    const exportData = wideData.map(row => {
      const newRow: any = {
        "栏位": row.pen,
        "耳标号": row.tag
      };
      dates.forEach(d => {
        const val = row[d];
        // Export NaN as null (empty cell) instead of error
        newRow[d] = (typeof val === 'number' && isNaN(val)) ? null : val;
      });
      newRow["统计结果"] = row.statResult;
      return newRow;
    });
    
    exportToExcel(
      exportData, 
      "猪场数据统计表.xlsx",
      { sourceFileName: fileName, daysCount: summaryStats.daysCount }
    );
  };

  // View Helpers
  const step1PreviewData = useMemo(() => longData.slice(0, 100), [longData]);
  const step2PreviewData = useMemo(() => cleanedData.slice(0, 100), [cleanedData]);
  const widePreviewData = useMemo(() => wideData.slice(0, 50), [wideData]);

  return (
    <div className="min-h-screen pb-20 selection:bg-blue-100">
      <LoadingOverlay isLoading={isLoading} />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-500/30">
                <PiggyBank size={24} />
              </div>
              <span>猪场数据自动化处理工具</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-blue-100 mr-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>v1.0.4</span>
             </div>
             
             {/* Config Buttons */}
             <div className="flex gap-2">
                <Button 
                   variant="outline" 
                   className="py-1.5 px-3 text-xs h-9" 
                   onClick={handleSaveConfig}
                   title="保存当前配置"
                   icon={<Save size={14} />}
                >
                   保存配置
                </Button>
                <div className="relative">
                   <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleLoadConfig}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
                   <Button 
                      variant="outline" 
                      className="py-1.5 px-3 text-xs h-9" 
                      title="加载配置"
                      icon={<RotateCcw size={14} />}
                   >
                      加载配置
                   </Button>
                </div>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* STEP 0 */}
        <StepCard 
          title="数据导入" 
          stepNumber={0} 
          isActive={currentStep === 0} 
          isCompleted={currentStep > 0}
          statusBadge={fileName && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded-full text-slate-600 font-medium border border-slate-200">
                <FileSpreadsheet size={14} className="text-emerald-600" />
                {fileName}
              </div>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="text-slate-400 hover:text-red-600 p-1.5 h-auto w-auto"
                title="清空并重新开始"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}
        >
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group relative bg-slate-50">
             <input 
               key={resetKey} // Force reset of file input when key changes
               type="file" 
               accept=".xlsx, .xls"
               onChange={handleFileUpload}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
             />
             <div className="space-y-4 flex flex-col items-center">
               <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-10 h-10 text-blue-600" />
               </div>
               <div className="space-y-1">
                  {fileName ? (
                    <div>
                       <p className="text-lg font-semibold text-slate-800">{fileName}</p>
                       <p className="text-sm text-slate-500">点击更换文件</p>
                    </div>
                  ) : (
                    <>
                       <p className="text-lg font-medium text-slate-700">点击选择或拖拽 Excel 文件到此处</p>
                       <p className="text-sm text-slate-500">支持 .xlsx, .xls 格式</p>
                    </>
                  )}
               </div>
             </div>
          </div>
          
          {rawData.length > 0 && (
             <div className="mt-6 flex justify-end gap-3 animate-fade-in border-t border-slate-100 pt-6">
               <Button 
                 variant="danger" 
                 onClick={handleReset}
                 className="px-5"
               >
                 <Trash2 size={16} /> 清空重置
               </Button>
               <Button onClick={finishStep0} icon={<ArrowRight size={16} />} className="px-6 text-base">
                 开始处理
               </Button>
             </div>
          )}
        </StepCard>

        {/* STEP 1 */}
        <StepCard 
          title="数据标准化 (Standardization)" 
          stepNumber={1} 
          isActive={currentStep === 1} 
          isCompleted={currentStep > 1}
        >
          <div className="bg-blue-50/80 border border-blue-100 p-4 mb-6 rounded-lg flex items-start gap-3">
             <div className="bg-blue-100 p-1.5 rounded-full mt-0.5">
               <CheckCircle2 size={16} className="text-blue-600" />
             </div>
             <p className="text-sm text-blue-800 leading-relaxed">
               自动识别成功！检测到 <strong className="font-semibold">{dateCols.length}</strong> 个日期列。<br/>
               数据预览已生成，共读取 <strong className="font-semibold">{longData.length}</strong> 条有效记录。
             </p>
          </div>
          <DataTable 
            columns={[
              { key: 'date', label: '日期' },
              { key: 'pen', label: '栏位' },
              { key: 'tag', label: '耳标号' },
              { key: 'rawVal', label: '原始数值' }
            ]}
            data={step1PreviewData}
          />
          <div className="mt-6 flex justify-end">
            <Button onClick={finishStep1} icon={<ArrowRight size={16} />}>下一步: 数据清洗</Button>
          </div>
        </StepCard>

        {/* STEP 2 */}
        <StepCard 
          title="数据清洗 (Cleaning)" 
          stepNumber={2} 
          isActive={currentStep === 2} 
          isCompleted={currentStep > 2}
        >
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl mb-6">
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                    <input 
                      id="check-x2" 
                      type="checkbox" 
                      checked={multiplyBy2}
                      onChange={(e) => {
                        setMultiplyBy2(e.target.checked);
                        handleRunCleaning(e.target.checked);
                      }}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                    />
                    <label htmlFor="check-x2" className="ml-3 text-sm font-medium text-slate-700 cursor-pointer select-none">
                      每日饲喂两次 (数值 × 2)
                    </label>
                </div>
                
                <div className="text-xs text-slate-500 bg-white/50 px-3 py-2 rounded-lg border border-slate-200/50 flex items-center gap-2">
                    <RefreshCw size={12} className="text-purple-500" />
                    <span>自动处理规则: 缺失/无变化 → 沿用上一次 | "空栏/死亡" → 排除计算</span>
                </div>
             </div>
          </div>
          
          <DataTable 
             columns={[
               { key: 'date', label: '日期' },
               { key: 'tag', label: '耳标号' },
               { key: 'val', label: '清洗后数值', render: (v) => {
                   if (typeof v === 'number' && isNaN(v)) return <span className="text-slate-300 italic text-xs">Excluded</span>;
                   return <span className="font-mono font-bold text-blue-600">{v}</span>;
               }},
               { key: 'status', label: '状态', render: (v) => {
                 let colorClass = 'bg-slate-100 text-slate-600';
                 if (v === '正常') colorClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                 else if (v === '已结束' || ['上产房', '死亡', '淘汰', '空栏'].some(k => v.includes(k))) colorClass = 'bg-rose-50 text-rose-700 border border-rose-100';
                 else colorClass = 'bg-amber-50 text-amber-700 border border-amber-100';

                 return (
                   <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
                     {v}
                   </span>
                 );
               }}
             ]}
             data={step2PreviewData}
          />
          <div className="mt-6 flex justify-end">
             <Button onClick={finishStep2} icon={<ArrowRight size={16} />}>下一步: 刻度转换</Button>
          </div>
        </StepCard>

        {/* STEP 3 */}
        <StepCard 
          title="刻度转换 (Conversion)" 
          stepNumber={3} 
          isActive={currentStep === 3} 
          isCompleted={currentStep > 3}
        >
           <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
              <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold text-sm border-b border-slate-100 pb-2">
                <Settings2 size={16} className="text-blue-500" />
                转换公式配置 <span className="text-slate-400 font-normal ml-2 text-xs">(x = 清洗后的刻度值)</span>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center">
                    <input 
                      type="radio" 
                      name="formula" 
                      id="f1" 
                      checked={conversionMode === 'direct'}
                      onChange={() => {
                        setConversionMode('direct');
                        handleRunConversion('direct', customFormula);
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="f1" className="ml-3 text-sm font-medium text-slate-700">直接使用 (y = x)</label>
                 </div>
                 <div className="flex items-center">
                    <input 
                      type="radio" 
                      name="formula" 
                      id="f2" 
                      checked={conversionMode === 'custom'}
                      onChange={() => {
                         setConversionMode('custom');
                         if(customFormula) handleRunConversion('custom', customFormula);
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="f2" className="ml-3 text-sm font-medium text-slate-700">自定义公式</label>
                 </div>
                 <div className="pl-7">
                    <div className="relative max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 text-sm italic">y =</span>
                        </div>
                        <input 
                          type="text" 
                          placeholder="例如: x * 0.85 + 2" 
                          disabled={conversionMode !== 'custom'}
                          value={customFormula}
                          onChange={(e) => {
                            setCustomFormula(e.target.value);
                          }}
                          onBlur={() => handleRunConversion('custom', customFormula)}
                          className="w-full pl-10 border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 border disabled:bg-slate-50 disabled:text-slate-400 transition-colors font-mono"
                        />
                    </div>
                 </div>
              </div>
           </div>

           <DataTable 
             columns={[
               { key: 'date', label: '日期' },
               { key: 'tag', label: '耳标号' },
               { key: 'val', label: '原值 (x)', render: (v) => {
                   if (typeof v === 'number' && isNaN(v)) return <span className="text-slate-300 italic text-xs">Excluded</span>;
                   return <span className="font-mono text-slate-500">{v}</span>;
               }},
               { key: 'convertedVal', label: '转换后 (y)', render: (v) => {
                   if (typeof v === 'number' && isNaN(v)) return <span className="text-slate-300">-</span>;
                   return <span className="font-bold text-indigo-600 font-mono">{v}</span> 
               }}
             ]}
             data={step2PreviewData}
           />

           <div className="mt-6 flex justify-end">
             <Button onClick={finishStep3} icon={<ArrowRight size={16} />}>计算并下一步</Button>
           </div>
        </StepCard>

        {/* STEP 4 */}
        <StepCard 
          title="宽表预览 (Wide Format)" 
          stepNumber={4} 
          isActive={currentStep === 4} 
          isCompleted={currentStep > 4}
        >
           <p className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
             <span className="font-semibold text-slate-700">说明：</span> 数据已转换为宽表格式，每一行代表一头猪在不同日期的数值，方便后续统计计算。
           </p>
           
           <DataTable 
             columns={[
               { key: 'pen', label: '栏位' },
               { key: 'tag', label: '耳标号' },
               ...dates.map(d => ({ key: d, label: d, render: (v: any) => {
                   if (typeof v === 'number' && isNaN(v)) return <span className="text-slate-200 text-xs">-</span>;
                   return v !== undefined && v !== null ? v : <span className="text-slate-200">-</span>;
               }}))
             ]}
             data={widePreviewData}
           />

           <div className="mt-6 flex justify-end">
             <Button onClick={finishStep4} icon={<ArrowRight size={16} />}>下一步: 耗料统计</Button>
           </div>
        </StepCard>

        {/* STEP 5 */}
        <StepCard 
          title="报表统计 (Statistics)" 
          stepNumber={5} 
          isActive={currentStep === 5} 
          isCompleted={currentStep > 5}
        >
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 flex flex-col items-center relative overflow-hidden group hover:shadow-md transition-all">
                 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <PiggyBank size={64} />
                 </div>
                 <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-2">有效猪只数</p>
                 <p className="text-3xl font-extrabold text-blue-700 tracking-tight">{summaryStats.totalPigs}</p>
                 <p className="text-[10px] text-blue-400 mt-1">(排除空栏/死亡)</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100 flex flex-col items-center relative overflow-hidden group hover:shadow-md transition-all">
                 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Calculator size={64} />
                 </div>
                 <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-2">总计算值</p>
                 <p className="text-3xl font-extrabold text-emerald-700 tracking-tight">{summaryStats.totalVal.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-6 rounded-2xl border border-violet-100 flex flex-col items-center relative overflow-hidden group hover:shadow-md transition-all">
                 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 size={64} />
                 </div>
                 <p className="text-xs text-violet-500 font-bold uppercase tracking-wider mb-2">平均每头</p>
                 <p className="text-3xl font-extrabold text-violet-700 tracking-tight">{summaryStats.avgVal}</p>
              </div>
              {/* New Days Count Card */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100 flex flex-col items-center relative overflow-hidden group hover:shadow-md transition-all">
                 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CalendarDays size={64} />
                 </div>
                 <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-2">统计天数</p>
                 <p className="text-3xl font-extrabold text-amber-700 tracking-tight">{summaryStats.daysCount}</p>
                 <p className="text-[10px] text-amber-400 mt-1">天</p>
              </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 flex items-center justify-between flex-wrap gap-4 shadow-sm">
              <div className="flex items-center gap-4">
                 <div className="bg-slate-100 p-2 rounded-lg">
                   <Settings2 size={20} className="text-slate-500" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">统计计算方式</label>
                   <select 
                     value={statMethod}
                     onChange={(e) => {
                       const m = e.target.value as StatMethod;
                       setStatMethod(m);
                       calculateStatistics(m);
                     }}
                     className="block w-full min-w-[200px] border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 pl-3 pr-8 border bg-white font-medium text-slate-700"
                   >
                      <option value="SUM">求和 (SUM)</option>
                      <option value="AVG">平均值 (AVERAGE)</option>
                      <option value="MAX">最大值 (MAX)</option>
                      <option value="MIN">最小值 (MIN)</option>
                      <option value="DIFF">首尾差值 (First - Last)</option>
                   </select>
                 </div>
              </div>
              <div className="text-sm text-slate-400 max-w-xs text-right hidden sm:block">
                 选择不同的统计方式会实时更新上方的汇总数据。
              </div>
           </div>

           <div className="flex justify-center pb-4">
              <Button 
                variant="success" 
                onClick={handleDownload} 
                className="px-8 py-4 text-base rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-1 transform transition-all duration-300 font-bold"
                icon={<Save size={20} />}
              >
                导出最终 Excel 报表
              </Button>
           </div>
        </StepCard>

      </main>
    </div>
  );
}

export default App;
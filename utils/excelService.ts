import * as XLSX from 'xlsx';
import { DateColumn, LongDataRow, RawDataRow, WideDataRow } from '../types';

export const parseExcelFile = (file: File): Promise<{ rawData: RawDataRow[], rawHeaders: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header:1 to get array of arrays first to check structure if needed, 
        // but utils.sheet_to_json is generally safer for key-value.
        const jsonData = XLSX.utils.sheet_to_json<RawDataRow>(worksheet, { defval: "" });
        
        if (jsonData.length === 0) throw new Error("Excel 文件为空");
        
        // Extract headers from first row keys
        const headers = Object.keys(jsonData[0]);
        
        resolve({ rawData: jsonData, rawHeaders: headers });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const identifyColumns = (headers: string[]): { penKey: string, tagKey: string, dateCols: DateColumn[] } => {
  let penKey = '';
  let tagKey = '';
  const dateCols: DateColumn[] = [];

  // Regex for "料桶刻度XX月XX日"
  // Matches "料桶刻度" followed by anything, then digits + 月 + digits + 日
  const dateRegex = /料桶刻度.*?(\d{1,2})月(\d{1,2})日/;

  headers.forEach((h, idx) => {
    const str = String(h).trim();
    if (str.includes('栏位')) penKey = h;
    else if (str.includes('耳标')) tagKey = h;
    else {
      const match = str.match(dateRegex);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        // Sort value: MM * 100 + DD (Simple assumption: all same year)
        const sortVal = month * 100 + day;
        dateCols.push({
          index: idx,
          originalName: h,
          dateStr: `${month}/${day}`,
          sortVal: sortVal
        });
      }
    }
  });

  return { penKey, tagKey, dateCols };
};

export const transformToLongFormat = (rawData: RawDataRow[], penKey: string, tagKey: string, dateCols: DateColumn[]): LongDataRow[] => {
  const longData: LongDataRow[] = [];

  // Sort columns chronologically for consistent processing
  const sortedDateCols = [...dateCols].sort((a, b) => a.sortVal - b.sortVal);

  rawData.forEach(row => {
    const pen = penKey ? String(row[penKey] || '') : '';
    const tag = String(row[tagKey] || '');

    if (!tag) return; // Skip rows without tag

    sortedDateCols.forEach(dc => {
      let val = row[dc.originalName];
      if (val === undefined || val === null) val = "";

      longData.push({
        pen,
        tag,
        date: dc.dateStr,
        dateSort: dc.sortVal,
        rawVal: val
      });
    });
  });

  return longData;
};

export const cleanData = (longData: LongDataRow[], multiplyBy2: boolean): LongDataRow[] => {
  // 1. Sort: Pen -> Tag -> Date
  const sorted = [...longData].sort((a, b) => {
    if (a.pen !== b.pen) return a.pen.localeCompare(b.pen, undefined, { numeric: true });
    if (a.tag !== b.tag) return a.tag.localeCompare(b.tag, undefined, { numeric: true });
    return a.dateSort - b.dateSort;
  });

  let currentTag = '';
  let lastVal: number | null = null;
  let isTerminated = false;
  
  // Keywords that indicate the record should stop and be excluded from stats
  // Added "空栏" explicitly to ensure it triggers exclusion
  const terminationKeywords = ["上产房", "死亡", "淘汰", "卖猪", "转出", "上市", "空栏"];
  
  return sorted.map(row => {
    // Reset context on new tag
    if (row.tag !== currentTag) {
      currentTag = row.tag;
      lastVal = null;
      isTerminated = false;
    }

    let val = row.rawVal;
    let status = "正常";
    let finalVal = 0;

    const valStr = String(val).trim();
    
    // Check if tag is already terminated
    if (isTerminated) {
      return { ...row, val: NaN, status: "已结束" };
    }

    // Check for termination keywords in current cell
    if (terminationKeywords.some(k => valStr.includes(k))) {
      isTerminated = true;
      return { ...row, val: NaN, status: valStr };
    }

    const isInvalid = valStr === "" || valStr === "无变化" || valStr === "null" || valStr.toLowerCase() === "nan";
    
    if (isInvalid) {
      if (lastVal !== null) {
        finalVal = lastVal;
        status = "自动填充";
      } else {
        finalVal = 0;
        status = "缺失置0";
      }
    } else {
      const num = parseFloat(valStr);
      if (isNaN(num)) {
         if (lastVal !== null) {
           finalVal = lastVal;
           status = "非数值填充";
         } else {
           finalVal = 0;
           status = "错误置0";
         }
      } else {
        finalVal = num;
      }
    }

    if (multiplyBy2) {
      finalVal = finalVal * 2;
    }

    lastVal = finalVal;

    return {
      ...row,
      val: finalVal,
      status
    };
  });
};

export const pivotData = (cleanedData: LongDataRow[], dateCols: DateColumn[]): { wideData: WideDataRow[], sortedDates: string[] } => {
  const map = new Map<string, WideDataRow>();
  const sortedDates = [...dateCols].sort((a, b) => a.sortVal - b.sortVal).map(d => d.dateStr);

  cleanedData.forEach(row => {
    if (!map.has(row.tag)) {
      map.set(row.tag, { pen: row.pen, tag: row.tag });
    }
    const entry = map.get(row.tag)!;
    // Use convertedVal if present, otherwise val. 
    // If NaN, it will be assigned as NaN.
    entry[row.date] = row.convertedVal !== undefined ? row.convertedVal : row.val;
  });

  return { 
    wideData: Array.from(map.values()), 
    sortedDates 
  };
};

export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Data") => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
};
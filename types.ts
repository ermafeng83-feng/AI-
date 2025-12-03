import React from 'react';

export interface RawDataRow {
  [key: string]: any;
}

export interface DateColumn {
  index: number;
  originalName: string;
  dateStr: string;
  sortVal: number;
}

export interface LongDataRow {
  pen: string;
  tag: string;
  date: string;
  dateSort: number;
  rawVal: any;
  // Step 2 added fields
  val?: number;
  status?: string;
  // Step 3 added fields
  convertedVal?: number;
}

export interface WideDataRow {
  pen: string;
  tag: string;
  [date: string]: any; // Dynamic date keys
  statResult?: number; // Calculated statistic
}

export type StatMethod = 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'DIFF';

export interface StepProps {
  isActive: boolean;
  isCompleted: boolean;
  onNext?: () => void;
  title: string;
  stepNumber: number;
  children: React.ReactNode;
}
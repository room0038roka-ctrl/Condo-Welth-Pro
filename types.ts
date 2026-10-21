
export type BuildingType = 'new_certified' | 'new_standard' | 'existing';

export interface SimulationInputs {
  propertyName: string;   // 物件名
  purchasePrice: number;
  areaSize: number;
  initialCosts: number; 
  useAutoInitialCosts: boolean; 
  downPayment: number;
  mortgageTerm: number;
  interestRate: number;
  maintenanceFee: number;
  repairFund: number;
  fixedAssetTax: number; 
  useAutoTax: boolean;    
  landRatio: number;      
  yearsHeld: number;
  appreciationRate: number;
  isPrimaryResidence: boolean;
  monthlyTakeHomeIncome: number;
  buildingType: BuildingType;
  useAutoSellingCosts: boolean;
  manualSellingCosts: number;
  // Access & Commute
  propertyAddress: string;
  targetStation: string;
  nearestStation: string;  // 最寄駅
  walkMinutes: number;     // 徒歩分数
  buildingAge: number;     // 築年数
  // Rental Comparison
  estimatedMonthlyRent: number;
  estimatedRentReasoning?: string;
  estimatedRentExamples?: {
    propertyName: string;
    rentText: string;
    area?: string;
    floor?: string;
    url?: string;
    sourceName?: string;
  }[];
  estimatedRentSources?: { title: string; uri: string }[];
  rentalYield: number;    // 想定利回り
  useAutoRent: boolean; 
  movingCosts: number;    // 旧引越し費用互換用
  initialMovingCosts: number; // 入居時（現在の家から）の引越し・退去費用
  exitMovingCosts: number;    // 売却後・退去時の引越し費用
  repairFundAnnualIncreaseRate?: number; // 修繕積立金の年あたり上昇率想定(%)
  currentMonthlyRent: number; // 現在の家賃
  // Property Tax Details
  landArea: number;
  landValuationPerSqM: number;
  buildingValuation: number;
  isNewBuildingReduction: boolean;
  newBuildingReductionYears: number; // 3 or 5
}

export interface SimulationResults {
  purchasePrice: number;
  initialTotalCost: number; 
  initialBrokerageFee: number;
  initialOtherCosts: number; 
  initialMovingCosts: number; // 入居時引越し費用
  sellingPrice: number;
  totalMaintenanceCosts: number; 
  totalTaxPaid: number;          
  totalMortgagePayments: number; 
  remainingMortgageBalance: number;
  sellingCosts: number;
  sellingBrokerageFee: number; 
  sellingOtherCosts: number;     
  exitMovingCosts: number;    // 売却後引越し費用     
  taxAmount: number;
  netProfit: number;
  totalOutflow: number;
  totalInflow: number;
  totalMortgageTaxCredit: number;
  // Unit prices
  purchasePricePerSqM: number;
  rentPerSqM: number;
  // Monthly Details
  monthlyMortgagePayment: number;
  monthlyMaintenanceFee: number;
  monthlyRepairFund: number;
  monthlyTaxEquivalent: number;
  monthlyHousingCost: number;
  housingCostRatio: number;
  monthlySurplus: number;
  estimatedInitialFixedAssetTax: number; 
  estimatedInitialCityPlanningTax: number;
  totalInitialPropertyTax: number; 
  landEvaluation: number;
  buildingEvaluation: number;
  // Rental Comparison Results
  estimatedMonthlyRent: number; 
  totalRentalCost: number;
  netCostBuy: number; // 購入時の実質総負担額 (総出費 - 売却回収・還付)
  buyVsRentDifference: number; // 差額 (プラスなら購入が得、マイナスなら賃貸が得)
  yearlyData: YearlyData[];
}

export interface YearlyData {
  year: number;
  propertyValue: number;
  mortgageBalance: number;
  cumulativeCost: number;
  equity: number;
  taxCredit: number;
  yearlyFixedAssetTax: number;
  yearlyCityPlanningTax: number;
  yearlyTotalPropertyTax: number;
  cumulativeRentalCost: number;
}

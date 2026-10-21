
export const TAX_RATES = {
  SHORT_TERM: 0.3963,
  LONG_TERM: 0.20315,
  FIXED_ASSET: 0.014,    // 1.4%
  CITY_PLANNING: 0.003,  // 0.3%
};

export const EVALUATION_FACTORS = {
  LAND: 0.7,      // 市場価格の約70%
  BUILDING: 0.6,  // 市場価格의 約60%
};

export const BROKERAGE_FEE_RATE = 0.03;
export const BROKERAGE_FEE_FIXED = 60000;
export const CONSUMPTION_TAX = 1.1;

export const MORTGAGE_TAX_CREDIT = {
  RATE: 0.007,
  DURATION: {
    new_certified: 13,
    new_standard: 13,
    existing: 10,
  },
  CAPS: {
    new_certified: 45000000,
    new_standard: 30000000,
    existing: 20000000,
  }
};

export const INITIAL_VALUES = {
  propertyName: '大崎駅前分譲マンション',
  purchasePrice: 50000000,
  areaSize: 70,
  initialCosts: 1500000,
  useAutoInitialCosts: true,
  downPayment: 1000000, 
  mortgageTerm: 30,     
  interestRate: 1.0,    
  maintenanceFee: 15000,
  repairFund: 10000,
  repairFundAnnualIncreaseRate: 2.0, // 年2%程度の段階的増額（10年で約20%増）を想定
  fixedAssetTax: 150000,
  useAutoTax: true,
  landRatio: 20,
  yearsHeld: 10,
  appreciationRate: -1.0,
  isPrimaryResidence: true,
  monthlyTakeHomeIncome: 425000,
  buildingType: 'new_standard' as const,
  useAutoSellingCosts: true,
  manualSellingCosts: 1800000,
  propertyAddress: '東京都品川区大崎2丁目',
  targetStation: '大崎ツインビル東館',
  nearestStation: '大崎駅',
  walkMinutes: 5,
  buildingAge: 10,
  estimatedMonthlyRent: 0, // 初期値は固定値を入れず、初回起動時にAIが走って自動算出・入力
  estimatedRentReasoning: '',
  estimatedRentExamples: [],
  estimatedRentSources: [],
  currentMonthlyRent: 80000,
  rentalYield: 4.2,      // デフォルト 4.2%
  useAutoRent: false,
  movingCosts: 200000,
  initialMovingCosts: 200000, // 入居時（現在の家から）の引越し・退去費用
  exitMovingCosts: 200000,    // 売却後・退去時の引越し費用
  // Property Tax Details
  landArea: 50,
  landValuationPerSqM: 500000,
  buildingValuation: 15000000,
  isNewBuildingReduction: true,
  newBuildingReductionYears: 3,
};

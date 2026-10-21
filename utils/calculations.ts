
import { SimulationInputs, SimulationResults, YearlyData } from '../types';
import { TAX_RATES, BROKERAGE_FEE_RATE, BROKERAGE_FEE_FIXED, CONSUMPTION_TAX, MORTGAGE_TAX_CREDIT, EVALUATION_FACTORS } from '../constants';

export const calculateMortgagePayment = (principal: number, annualRate: number, years: number) => {
  if (annualRate === 0) return principal / (years * 12);
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = years * 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
};

export const calculateMortgageBalance = (principal: number, annualRate: number, years: number, paymentsMade: number) => {
  const monthlyRate = annualRate / 100 / 12;
  const numberOfPayments = years * 12;
  if (annualRate === 0) return Math.max(0, principal * (1 - paymentsMade / numberOfPayments));
  const balance = principal * (Math.pow(1 + monthlyRate, numberOfPayments) - Math.pow(1 + monthlyRate, paymentsMade)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  return Math.max(0, balance);
};

export const calculateDetailedYearlyTax = (inputs: SimulationInputs, year: number) => {
  const {
    purchasePrice, landRatio, buildingType,
    landArea, landValuationPerSqM, buildingValuation,
    isNewBuildingReduction, newBuildingReductionYears
  } = inputs;

  // 1. 土地の評価額と税額
  // 簡易計算（比率ベース）か詳細計算（面積・単価ベース）かを判断
  // ここでは詳細データがあればそれを使う
  const landEvaluation = (landArea > 0 && landValuationPerSqM > 0) 
    ? landArea * landValuationPerSqM 
    : purchasePrice * (landRatio / 100) * EVALUATION_FACTORS.LAND;

  // 住宅用地の特例
  // 小規模住宅用地（200㎡以下）: 1/6 (固定資産税), 1/3 (都市計画税)
  // 一般住宅用地（200㎡超）: 1/3 (固定資産税), 2/3 (都市計画税)
  let landFixedTax = 0;
  let landCityTax = 0;

  if (landArea <= 200) {
    landFixedTax = (landEvaluation / 6) * TAX_RATES.FIXED_ASSET;
    landCityTax = (landEvaluation / 3) * TAX_RATES.CITY_PLANNING;
  } else {
    const smallPart = 200;
    const generalPart = landArea - 200;
    const smallEval = (smallPart / landArea) * landEvaluation;
    const generalEval = (generalPart / landArea) * landEvaluation;
    
    landFixedTax = (smallEval / 6 + generalEval / 3) * TAX_RATES.FIXED_ASSET;
    landCityTax = (smallEval / 3 + generalEval * (2/3)) * TAX_RATES.CITY_PLANNING;
  }

  // 2. 建物の評価額と税額
  const initialBuildingEvaluation = buildingValuation > 0 
    ? buildingValuation 
    : purchasePrice * (1 - landRatio / 100) * EVALUATION_FACTORS.BUILDING;

  // 経年減価補正（簡易的に年2%減、下限20%）
  const currentBuildingEvaluation = initialBuildingEvaluation * Math.max(0.2, (1 - (year * 0.02)));
  
  let buildingFixedTax = currentBuildingEvaluation * TAX_RATES.FIXED_ASSET;
  const buildingCityTax = currentBuildingEvaluation * TAX_RATES.CITY_PLANNING;

  // 新築住宅の減額措置 (1/2)
  if (isNewBuildingReduction && year > 0 && year <= newBuildingReductionYears) {
    buildingFixedTax = buildingFixedTax * 0.5;
  }

  return {
    fixedAssetTax: landFixedTax + buildingFixedTax,
    cityPlanningTax: landCityTax + buildingCityTax,
    total: landFixedTax + buildingFixedTax + landCityTax + buildingCityTax
  };
};

export const calculateSimulation = (inputs: SimulationInputs): SimulationResults => {
  const {
    purchasePrice, areaSize, initialCosts, useAutoInitialCosts, downPayment, mortgageTerm, interestRate,
    maintenanceFee, repairFund, fixedAssetTax, useAutoTax, landRatio,
    yearsHeld, appreciationRate, isPrimaryResidence, monthlyTakeHomeIncome, buildingType,
    useAutoSellingCosts, manualSellingCosts, estimatedMonthlyRent, useAutoRent, movingCosts,
    landArea, landValuationPerSqM, buildingValuation, isNewBuildingReduction, newBuildingReductionYears
  } = inputs;

  const initialMovingCosts = inputs.initialMovingCosts !== undefined ? inputs.initialMovingCosts : (movingCosts || 0);
  const exitMovingCosts = inputs.exitMovingCosts !== undefined ? inputs.exitMovingCosts : 0;

  const loanAmount = purchasePrice - downPayment;
  const monthlyPayment = calculateMortgagePayment(loanAmount, interestRate, mortgageTerm);

  // 1. 購入時諸経費
  let initialBrokerageFee = 0;
  let initialOtherCosts = 0;
  if (useAutoInitialCosts) {
    if (buildingType === 'existing') {
      initialBrokerageFee = (purchasePrice * BROKERAGE_FEE_RATE + BROKERAGE_FEE_FIXED) * CONSUMPTION_TAX;
    }
    initialOtherCosts = purchasePrice * 0.025 + (loanAmount > 0 ? 50000 : 0);
  } else {
    initialOtherCosts = initialCosts;
  }
  // 入居時（現在の家から）の引越し費用を初期費用に計上
  const totalInitialCosts = initialBrokerageFee + initialOtherCosts + initialMovingCosts;
  
  // 2. 単価算出
  const purchasePricePerSqM = areaSize > 0 ? purchasePrice / areaSize : 0;
  // ユーザーの要望: 賃料㎡単価 = 比較対象の賃料 ÷ 専有面積
  const rentPerSqM = areaSize > 0 ? estimatedMonthlyRent / areaSize : 0;

  const yearlyData: YearlyData[] = [];
  let totalMortgagePayments = 0;
  let totalMaintenanceCosts = 0; 
  let totalTaxPaid = 0;          
  let totalTaxCredit = 0;

  const creditDuration = typeof MORTGAGE_TAX_CREDIT.DURATION === 'object' 
    ? (MORTGAGE_TAX_CREDIT.DURATION[buildingType] || 10) 
    : 13;
  const creditCap = MORTGAGE_TAX_CREDIT.CAPS[buildingType];
  const initialTaxDetailed = calculateDetailedYearlyTax(inputs, 1);
  const effectiveInitialTax = useAutoTax ? initialTaxDetailed.total : fixedAssetTax;

  const rentalInitialCosts = estimatedMonthlyRent * 3.5;
  let runningRentalCost = rentalInitialCosts;

  for (let y = 0; y <= yearsHeld; y++) {
    const propertyValue = purchasePrice * Math.pow(1 + appreciationRate / 100, y);
    const balance = calculateMortgageBalance(loanAmount, interestRate, mortgageTerm, y * 12);
    
    const taxDetailed = calculateDetailedYearlyTax(inputs, y);
    const yearlyTotalTax = useAutoTax ? taxDetailed.total : fixedAssetTax;
    
    let currentYearTaxCredit = 0;
    if (y > 0 && y <= creditDuration && areaSize >= 50) {
      const startOfYearBalance = calculateMortgageBalance(loanAmount, interestRate, mortgageTerm, (y - 1) * 12);
      currentYearTaxCredit = Math.min(startOfYearBalance, creditCap) * MORTGAGE_TAX_CREDIT.RATE;
      totalTaxCredit += currentYearTaxCredit;
    }

    if (y > 0) {
      totalMortgagePayments += monthlyPayment * 12;
      // 修繕積立金の経年増額（年次上昇率を反映、デフォルト年2%）
      const yearlyIncreaseRate = (inputs.repairFundAnnualIncreaseRate !== undefined) ? inputs.repairFundAnnualIncreaseRate : 2.0;
      const currentYearRepairFund = repairFund * Math.pow(1 + yearlyIncreaseRate / 100, y - 1);
      totalMaintenanceCosts += (maintenanceFee + currentYearRepairFund) * 12;
      totalTaxPaid += yearlyTotalTax;
      
      runningRentalCost += estimatedMonthlyRent * 12;
      if (y % 2 === 0) {
        runningRentalCost += estimatedMonthlyRent;
      }
    }

    yearlyData.push({
      year: y,
      propertyValue,
      mortgageBalance: balance,
      cumulativeCost: 0,
      equity: propertyValue - balance,
      taxCredit: currentYearTaxCredit,
      yearlyFixedAssetTax: useAutoTax ? taxDetailed.fixedAssetTax : fixedAssetTax * (1.4 / 1.7),
      yearlyCityPlanningTax: useAutoTax ? taxDetailed.cityPlanningTax : fixedAssetTax * (0.3 / 1.7),
      yearlyTotalPropertyTax: yearlyTotalTax,
      cumulativeRentalCost: runningRentalCost
    });
  }

  // 累計支出グラフ用データの補完
  let rollingOutflow = totalInitialCosts + downPayment;
  for (let i = 0; i <= yearsHeld; i++) {
    if (i > 0) {
      const yearlyIncreaseRate = (inputs.repairFundAnnualIncreaseRate !== undefined) ? inputs.repairFundAnnualIncreaseRate : 2.0;
      const currentYearRepairFund = repairFund * Math.pow(1 + yearlyIncreaseRate / 100, i - 1);
      rollingOutflow += (monthlyPayment * 12 + (maintenanceFee + currentYearRepairFund) * 12 + yearlyData[i].yearlyTotalPropertyTax - yearlyData[i].taxCredit);
    }
    yearlyData[i].cumulativeCost = rollingOutflow;
  }

  const finalPropertyValue = yearlyData[yearsHeld].propertyValue;
  const remainingBalance = yearlyData[yearsHeld].mortgageBalance;
  
  const autoBrokerageFee = (finalPropertyValue * BROKERAGE_FEE_RATE + BROKERAGE_FEE_FIXED) * CONSUMPTION_TAX;
  const autoOtherCosts = 60000; 
  const sellingBrokerageFee = useAutoSellingCosts ? autoBrokerageFee : manualSellingCosts;
  const sellingOtherCosts = useAutoSellingCosts ? autoOtherCosts : 0;
  // 売却後の引越し費用を売却時総費用に計上
  const totalSellingCosts = sellingBrokerageFee + sellingOtherCosts + exitMovingCosts;

  // 税務上の譲渡所得（キャピタルゲイン）計算：建物の減価償却費（RC非事業用定額法 償却率0.015）を考慮
  const buildingAcquisitionPrice = purchasePrice * (1 - (landRatio / 100));
  const depreciationAccumulated = buildingAcquisitionPrice * 0.9 * 0.015 * yearsHeld;
  const adjustedAcquisitionCost = Math.max(purchasePrice * 0.05, (purchasePrice - depreciationAccumulated) + totalInitialCosts);
  const capitalGain = finalPropertyValue - adjustedAcquisitionCost - totalSellingCosts;
  const taxableGain = isPrimaryResidence ? Math.max(0, capitalGain - 30000000) : Math.max(0, capitalGain);
  const taxAmount = taxableGain * (yearsHeld > 5 ? TAX_RATES.LONG_TERM : TAX_RATES.SHORT_TERM);

  const totalCashOutBuy = downPayment + totalInitialCosts + totalMortgagePayments + totalMaintenanceCosts + totalTaxPaid + remainingBalance + totalSellingCosts + taxAmount;
  const totalCashInBuy = finalPropertyValue + totalTaxCredit;
  const finalNetProfitBuy = totalCashInBuy - totalCashOutBuy;

  // 購入時の実質総負担額（持ち出し合計－売却回収額）
  const netCostBuy = totalCashOutBuy - totalCashInBuy;
  // 賃貸との差額（プラスなら購入が得、マイナスなら賃貸が得）
  const buyVsRentDifference = runningRentalCost - netCostBuy;

  const monthlyTaxEquivalent = effectiveInitialTax / 12;
  const monthlyHousingCost = monthlyPayment + maintenanceFee + repairFund + monthlyTaxEquivalent;
  const housingCostRatio = monthlyTakeHomeIncome > 0 ? (monthlyHousingCost / monthlyTakeHomeIncome) * 100 : 0;

  return {
    purchasePrice,
    initialTotalCost: totalInitialCosts,
    initialBrokerageFee,
    initialOtherCosts,
    initialMovingCosts,
    sellingPrice: finalPropertyValue,
    totalMaintenanceCosts,
    totalTaxPaid,
    totalMortgagePayments,
    remainingMortgageBalance: remainingBalance,
    sellingCosts: totalSellingCosts,
    sellingBrokerageFee,
    sellingOtherCosts,
    exitMovingCosts,
    taxAmount,
    netProfit: finalNetProfitBuy,
    totalOutflow: totalCashOutBuy,
    totalInflow: totalCashInBuy,
    totalMortgageTaxCredit: totalTaxCredit,
    // Unit prices
    purchasePricePerSqM,
    rentPerSqM,
    // Monthly details
    monthlyMortgagePayment: monthlyPayment,
    monthlyMaintenanceFee: maintenanceFee,
    monthlyRepairFund: repairFund,
    monthlyTaxEquivalent: monthlyTaxEquivalent,
    monthlyHousingCost,
    housingCostRatio,
    monthlySurplus: monthlyTakeHomeIncome - monthlyHousingCost,
    estimatedInitialFixedAssetTax: useAutoTax ? initialTaxDetailed.fixedAssetTax : fixedAssetTax * (1.4 / 1.7),
    estimatedInitialCityPlanningTax: useAutoTax ? initialTaxDetailed.cityPlanningTax : fixedAssetTax * (0.3 / 1.7),
    totalInitialPropertyTax: effectiveInitialTax,
    landEvaluation: (landArea > 0 && landValuationPerSqM > 0) ? landArea * landValuationPerSqM : purchasePrice * (landRatio / 100) * EVALUATION_FACTORS.LAND,
    buildingEvaluation: buildingValuation > 0 ? buildingValuation : purchasePrice * (1 - landRatio / 100) * EVALUATION_FACTORS.BUILDING,
    estimatedMonthlyRent: estimatedMonthlyRent,
    totalRentalCost: runningRentalCost,
    netCostBuy,
    buyVsRentDifference,
    yearlyData
  };
};

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(val);
};

import type { TermDefinition } from '@formulaflash/core';
import { CFD_GLOSSARY as CORE_CFD_GLOSSARY } from '@formulaflash/core';

export interface FlashcardItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  shortPrompt?: string;
  latexAnswer: string;
  hint: string;
  cheatSheetNote?: string;
  explanation: string;
  terms?: TermDefinition[];
}

export const CFD_GLOSSARY: Record<string, TermDefinition> = CORE_CFD_GLOSSARY;

export const SAMPLE_DECK: FlashcardItem[] = [
  {
    id: 'cfd-incompressible-momentum',
    category: 'Fluid Dynamics',
    title: 'Incompressible Momentum (Navier-Stokes)',
    prompt: 'State the incompressible Navier-Stokes momentum equation with velocity vector ($\\mathbf{u}$), pressure ($p$), density ($\\rho$), kinematic viscosity ($\\nu$), and time ($t$):',
    shortPrompt: 'Incompressible Navier-Stokes momentum',
    latexAnswer: '\\frac{\\partial \\mathbf{u}}{\\partial t} + (\\mathbf{u} \\cdot \\nabla)\\mathbf{u} = -\\frac{1}{\\rho}\\nabla p + \\nu \\nabla^2 \\mathbf{u}',
    hint: 'Material derivative of velocity equals pressure gradient force plus viscous diffusion.',
    cheatSheetNote: 'Material accel = -grad(p)/rho + nu*Lap(u)',
    explanation: 'Fundamental momentum balance for constant-density, constant-viscosity Newtonian fluid flows.',
    terms: [
      { symbol: '\\mathbf{u}', name: 'Fluid velocity vector', shortName: 'Velocity u', definition: 'Continuum vector velocity field.', shortDefinition: 'Continuum velocity field', units: 'm/s' },
      { symbol: 't', name: 'Time coordinate', shortName: 'Time', definition: 'Temporal dimension.', shortDefinition: 'Time coordinate', units: 's' },
      { symbol: '\\rho', name: 'Fluid density', shortName: 'Density', definition: 'Mass per unit volume.', shortDefinition: 'Mass per unit volume', units: 'kg/m^3' },
      { symbol: 'p', name: 'Static pressure', shortName: 'Pressure', definition: 'Isotropic compressive stress field.', shortDefinition: 'Static fluid pressure', units: 'Pa' },
      { symbol: '\\nu', name: 'Kinematic viscosity', shortName: 'Kin viscosity', definition: 'Ratio of dynamic viscosity to fluid density.', shortDefinition: 'Momentum diffusivity mu/rho', units: 'm^2/s' },
    ],
  },
  {
    id: 'cfd-continuity',
    category: 'Fluid Dynamics',
    title: 'Incompressible Continuity Equation',
    prompt: 'State the mass continuity equation for an incompressible fluid with velocity ($\\mathbf{u}$):',
    shortPrompt: 'Incompressible mass continuity',
    latexAnswer: '\\nabla \\cdot \\mathbf{u} = 0',
    hint: 'Divergence of the velocity vector is zero.',
    cheatSheetNote: 'Zero velocity divergence (solenoidal flow)',
    explanation: 'Reflects volume conservation and constant density along fluid trajectories.',
    terms: [
      { symbol: '\\mathbf{u}', name: 'Velocity field', shortName: 'Velocity u', definition: 'Solenoidal velocity vector field.', shortDefinition: 'Velocity vector field', units: 'm/s' },
    ],
  },
  {
    id: 'cfd-reynolds-number',
    category: 'Fluid Dynamics',
    title: 'Reynolds Number Definition',
    prompt: 'State the definition of the Reynolds number ($Re$) in terms of density ($\\rho$), velocity ($u$), length ($L$), and dynamic viscosity ($\\mu$):',
    shortPrompt: 'Reynolds number Re',
    latexAnswer: 'Re = \\frac{\\rho u L}{\\mu}',
    hint: 'Inertial scaling divided by dynamic viscosity.',
    cheatSheetNote: 'Inertial / viscous force scaling',
    explanation: 'Governs laminar versus turbulent flow transitions and dynamic similitude.',
    terms: [
      { symbol: 'Re', name: 'Reynolds number', shortName: 'Reynolds', definition: 'Dimensionless ratio of inertial to viscous forces.', shortDefinition: 'Inertial / viscous ratio', units: 'dimensionless' },
      { symbol: '\\rho', name: 'Fluid density', shortName: 'Density', definition: 'Mass per unit volume.', shortDefinition: 'Mass per unit volume', units: 'kg/m^3' },
      { symbol: 'u', name: 'Characteristic velocity', shortName: 'Velocity u', definition: 'Characteristic speed of the flow.', shortDefinition: 'Characteristic flow speed', units: 'm/s' },
      { symbol: 'L', name: 'Characteristic length', shortName: 'Length L', definition: 'Macroscopic geometric length scale.', shortDefinition: 'Characteristic length', units: 'm' },
      { symbol: '\\mu', name: 'Dynamic viscosity', shortName: 'Dyn viscosity', definition: 'Dynamic shear viscosity.', shortDefinition: 'Shear viscosity mu', units: 'Pa*s' },
    ],
  },
  {
    id: 'cfd-mach-number',
    category: 'Fluid Dynamics',
    title: 'Mach Number Definition',
    prompt: 'State the definition of Mach number ($Ma$) using flow velocity ($u$) and local speed of sound ($a$):',
    shortPrompt: 'Mach number Ma',
    latexAnswer: 'Ma = \\frac{u}{a}',
    hint: 'Ratio of fluid speed to acoustic wave speed.',
    cheatSheetNote: 'Flow speed / local sound speed',
    explanation: 'Dimensionless metric characterizing compressibility effects.',
    terms: [
      { symbol: 'Ma', name: 'Mach number', shortName: 'Mach', definition: 'Compressibility metric.', shortDefinition: 'Flow / sound speed', units: 'dimensionless' },
      { symbol: 'u', name: 'Flow speed', shortName: 'Velocity u', definition: 'Magnitude of velocity relative to boundary.', shortDefinition: 'Local flow speed', units: 'm/s' },
      { symbol: 'a', name: 'Speed of sound', shortName: 'Sound speed a', definition: 'Speed of acoustic pressure waves in the fluid.', shortDefinition: 'Acoustic wave speed', units: 'm/s' },
    ],
  },
  {
    id: 'cfd-thermal-energy',
    category: 'Fluid Dynamics',
    title: 'Thermal Energy Transport',
    prompt: 'State the incompressible temperature transport equation with velocity ($\\mathbf{u}$), temperature ($T$), thermal diffusivity ($\\alpha$), and time ($t$):',
    shortPrompt: 'Incompressible temperature transport',
    latexAnswer: '\\frac{\\partial T}{\\partial t} + \\mathbf{u} \\cdot \\nabla T = \\alpha \\nabla^2 T',
    hint: 'Advection-diffusion equation for scalar temperature.',
    cheatSheetNote: 'Advection-diffusion of scalar temperature',
    explanation: 'Energy balance describing heat advection and Fourier conduction in a constant-property fluid.',
    terms: [
      { symbol: 'T', name: 'Temperature', shortName: 'Temp T', definition: 'Thermodynamic scalar temperature field.', shortDefinition: 'Absolute temperature', units: 'K' },
      { symbol: 't', name: 'Time', shortName: 'Time t', definition: 'Time coordinate.', shortDefinition: 'Time variable', units: 's' },
      { symbol: '\\mathbf{u}', name: 'Velocity vector', shortName: 'Velocity u', definition: 'Advecting velocity vector field.', shortDefinition: 'Advecting velocity', units: 'm/s' },
      { symbol: '\\alpha', name: 'Thermal diffusivity', shortName: 'Thermal diff', definition: 'Ratio of thermal conductivity to volumetric heat capacity (k / (rho * cp)).', shortDefinition: 'Thermal diffusivity k/(rho cp)', units: 'm^2/s' },
    ],
  },
  {
    id: 'ideal-gas',
    category: 'Thermodynamics',
    title: 'Ideal Gas Law',
    prompt: 'State the Ideal Gas equation relating pressure ($P$), volume ($V$), amount ($n$), gas constant ($R$), and temperature ($T$):',
    shortPrompt: 'Ideal gas equation of state',
    latexAnswer: 'PV = nRT',
    hint: 'Pressure times volume equals moles times constant times temperature.',
    cheatSheetNote: 'Ideal gas state equation (molar basis)',
    explanation: 'Fundamental equation of state for a hypothetical ideal gas.',
    terms: [
      { symbol: 'P', name: 'Absolute pressure', shortName: 'Pressure P', definition: 'Force per unit area exerted by gas molecules.', shortDefinition: 'Absolute gas pressure', units: 'Pa' },
      { symbol: 'V', name: 'Volume', shortName: 'Volume V', definition: 'Three-dimensional geometric space bounded by the gas.', shortDefinition: 'Gas container volume', units: 'm^3' },
      { symbol: 'n', name: 'Amount of substance', shortName: 'Moles n', definition: 'Number of moles of gas particles.', shortDefinition: 'Number of moles', units: 'mol' },
      { symbol: 'R', name: 'Universal gas constant', shortName: 'Gas const R', definition: 'Proportionality constant relating energy and temperature scales.', shortDefinition: 'Universal gas constant', units: 'J/(mol*K)' },
      { symbol: 'T', name: 'Absolute temperature', shortName: 'Temp T', definition: 'Thermodynamic temperature scale measured from absolute zero.', shortDefinition: 'Absolute temperature', units: 'K' },
    ],
  },
  {
    id: 'kinetic-energy',
    category: 'Classical Mechanics',
    title: 'Kinetic Energy',
    prompt: 'What is the classical formula for kinetic energy ($E$) of an object with mass ($m$) and velocity ($v$)?',
    shortPrompt: 'Translational kinetic energy',
    latexAnswer: 'E = \\frac{1}{2}mv^{2}',
    hint: 'One half mass times velocity squared.',
    cheatSheetNote: 'Classical translational motion energy',
    explanation: 'Kinetic energy is the work needed to accelerate a body of given mass from rest to stated velocity.',
    terms: [
      { symbol: 'E', name: 'Kinetic energy', shortName: 'Energy E', definition: 'Energy possessed by an object due to its motion.', shortDefinition: 'Translational energy', units: 'J' },
      { symbol: 'm', name: 'Mass', shortName: 'Mass m', definition: 'Quantitative measure of inertia resistance to acceleration.', shortDefinition: 'Body mass', units: 'kg' },
      { symbol: 'v', name: 'Velocity', shortName: 'Speed v', definition: 'Speed of motion along the trajectory.', shortDefinition: 'Motion speed', units: 'm/s' },
    ],
  },
  {
    id: 'gibbs-free-energy',
    category: 'Physical Chemistry',
    title: 'Gibbs Free Energy',
    prompt: 'Express the change in Gibbs Free Energy ($\\Delta G$) using enthalpy ($\\Delta H$), temperature ($T$), and entropy ($\\Delta S$):',
    shortPrompt: 'Gibbs free energy change',
    latexAnswer: '\\Delta G = \\Delta H - T\\Delta S',
    hint: 'Change in enthalpy minus temperature times change in entropy.',
    cheatSheetNote: 'Spontaneity criterion at const T, p',
    explanation: 'Thermodynamic potential calculating maximum reversible work at constant temperature and pressure.',
    terms: [
      { symbol: '\\Delta G', name: 'Gibbs free energy change', shortName: 'Delta G', definition: 'Thermodynamic potential change determining process spontaneity at constant temperature and pressure.', shortDefinition: 'Free energy change', units: 'J' },
      { symbol: '\\Delta H', name: 'Enthalpy change', shortName: 'Delta H', definition: 'Total heat absorbed or released under constant pressure.', shortDefinition: 'Enthalpy change', units: 'J' },
      { symbol: 'T', name: 'Absolute temperature', shortName: 'Temp T', definition: 'Thermodynamic temperature in kelvin.', shortDefinition: 'Absolute temperature', units: 'K' },
      { symbol: '\\Delta S', name: 'Entropy change', shortName: 'Delta S', definition: 'Change in microscopic thermal disorder or state multiplicity.', shortDefinition: 'Entropy change', units: 'J/K' },
    ],
  },
  {
    id: 'molar-density',
    category: 'Thermodynamics',
    title: 'Ideal Gas with Molar Density',
    prompt: 'State the Ideal Gas law formulated with molar density ($\\hat{\\rho}$), constant ($R$), and temperature ($T$):',
    shortPrompt: 'Ideal gas (molar density form)',
    latexAnswer: 'P = \\hat{\\rho} R T',
    hint: 'Pressure equals rho-hat times R times T.',
    cheatSheetNote: 'Ideal gas with molar density rho-hat',
    explanation: 'Decorator awareness example: the hat accent on rho ($\\hat{\\rho}$) distinguishes molar density from mass density.',
    terms: [
      { symbol: 'P', name: 'Static pressure', shortName: 'Pressure P', definition: 'Absolute thermodynamic pressure.', shortDefinition: 'Static gas pressure', units: 'Pa' },
      { symbol: '\\hat{\\rho}', name: 'Molar density', shortName: 'Molar rho-hat', definition: 'Amount of substance per unit volume (n / V). Distinguished by hat decorator.', shortDefinition: 'Moles per unit volume (n/V)', units: 'mol/m^3' },
      { symbol: 'R', name: 'Universal gas constant', shortName: 'Gas const R', definition: 'Molar gas constant.', shortDefinition: 'Universal gas constant', units: 'J/(mol*K)' },
      { symbol: 'T', name: 'Absolute temperature', shortName: 'Temp T', definition: 'Thermodynamic temperature.', shortDefinition: 'Absolute temperature', units: 'K' },
    ],
  },
  {
    id: 'quadratic-formula',
    category: 'Algebra',
    title: 'Quadratic Formula',
    prompt: 'What is the formula for the roots of $ax^{2} + bx + c = 0$?',
    shortPrompt: 'Quadratic roots formula',
    latexAnswer: 'x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}',
    hint: 'Negative b plus or minus square root of b squared minus 4ac, all over 2a.',
    cheatSheetNote: 'Roots of quadratic polynomial',
    explanation: 'Closed-form solution for the roots of any single-variable second-degree polynomial.',
    terms: [
      { symbol: 'x', name: 'Unknown variable', shortName: 'Root x', definition: 'Roots that satisfy the quadratic polynomial equation.', shortDefinition: 'Polynomial root' },
      { symbol: 'a', name: 'Quadratic coefficient', shortName: 'Coeff a', definition: 'Coefficient multiplying second-order term.', shortDefinition: 'x^2 coefficient' },
      { symbol: 'b', name: 'Linear coefficient', shortName: 'Coeff b', definition: 'Coefficient multiplying first-order term.', shortDefinition: 'x coefficient' },
      { symbol: 'c', name: 'Constant term', shortName: 'Const c', definition: 'Constant zero-order term.', shortDefinition: 'Constant offset' },
    ],
  },
  {
    id: 'ohms-law',
    category: 'Electromagnetism',
    title: "Ohm's Law",
    prompt: "State Ohm's Law relating voltage ($V$), current ($I$), and resistance ($R$):",
    shortPrompt: "Ohm's Law (V, I, R)",
    latexAnswer: 'V = IR',
    hint: 'Voltage equals current times resistance.',
    cheatSheetNote: 'Linear V-I resistor relationship',
    explanation: 'Relationship stating current through a conductor between two points is directly proportional to voltage across the points.',
    terms: [
      { symbol: 'V', name: 'Electric potential difference', shortName: 'Voltage V', definition: 'Voltage between two distinct terminals.', shortDefinition: 'Potential difference', units: 'V' },
      { symbol: 'I', name: 'Electric current', shortName: 'Current I', definition: 'Net rate of electric charge flow through a cross section.', shortDefinition: 'Electric charge flow rate', units: 'A' },
      { symbol: 'R', name: 'Electrical resistance', shortName: 'Resistance R', definition: 'Measure of opposition to electric charge flow.', shortDefinition: 'Opposition to current', units: 'Ohm' },
    ],
  },
];

import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BillboardType, PricingUnit } from '@prisma/client';

interface BillboardRuleTarget {
  type?: BillboardType;
  pricingUnit?: PricingUnit;
}

@ValidatorConstraint({ name: 'printedSubtypeMatchesType', async: false })
export class PrintedSubtypeMatchesTypeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    const target = args.object as BillboardRuleTarget;

    return target.type === undefined || target.type === BillboardType.PRINTED;
  }

  defaultMessage(): string {
    return 'printedSubtype is only valid for PRINTED billboards';
  }
}

@ValidatorConstraint({ name: 'hourPricingMatchesType', async: false })
export class HourPricingMatchesTypeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value !== PricingUnit.HOUR) {
      return true;
    }

    const target = args.object as BillboardRuleTarget;

    return target.type === undefined || target.type === BillboardType.CAR_AD;
  }

  defaultMessage(): string {
    return 'pricingUnit HOUR is only valid for CAR_AD billboards';
  }
}

@ValidatorConstraint({ name: 'displayDurationMatchesType', async: false })
export class DisplayDurationMatchesTypeConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    const target = args.object as BillboardRuleTarget;

    return target.type === undefined || target.type === BillboardType.DIGITAL;
  }

  defaultMessage(): string {
    return 'displayDurationSeconds is only valid for DIGITAL billboards';
  }
}

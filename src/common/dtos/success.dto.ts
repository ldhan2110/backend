import { IsBoolean } from "class-validator";

export class SuccessDto {
    @IsBoolean()
    success: boolean;
}
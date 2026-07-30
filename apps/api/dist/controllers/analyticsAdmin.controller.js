import * as analyticsAdminService from '../services/analyticsAdmin.service.js';
export async function getCompanyOverviewHandler(req, res, next) {
    try {
        const overview = await analyticsAdminService.getCompanyOverview();
        res.status(200).json(overview);
    }
    catch (err) {
        next(err);
    }
}
export async function getCountryPerformanceHandler(req, res, next) {
    try {
        const performance = await analyticsAdminService.getCountryPerformance();
        res.status(200).json(performance);
    }
    catch (err) {
        next(err);
    }
}
export async function getProductPerformanceHandler(req, res, next) {
    try {
        const performance = await analyticsAdminService.getProductPerformance();
        res.status(200).json(performance);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=analyticsAdmin.controller.js.map
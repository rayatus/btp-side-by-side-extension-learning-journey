using {riskmanagement as rm} from '../db/schema';

@path: 'service/risk'
service RiskService {
    entity Risks @(
        restrict: [
            {
                grant: ['READ'],
                to   : ['RiskViewer']
            },
            {
                grant: ['*'],
                to   : ['RiskManager']
            }
        ],
        odata.draft.enabled,
    )                       as projection on rm.Risks;

    
    entity Mitigations @(restrict: [
        {
            grant: ['READ'],
            to   : ['RiskViewer']
        },
        {
            grant: ['*'],
            to   : ['RiskManager']
        }
    ])                      as projection on rm.Mitigations;

    annotate Mitigations with @odata.draft.enabled;

    @readonly
    entity BusinessPartners as projection on rm.BusinessPartners;
}

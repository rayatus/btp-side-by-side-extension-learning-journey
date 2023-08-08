namespace riskmanagement;

using {managed} from '@sap/cds/common';

entity Risks : managed {
    key ID          : UUID @(Core.Computed: true);
        title       : String(100);
        owner       : String;
        prio        : String(5);
        descr       : String;
        miti        : Association to Mitigations;
        impact      : Integer;
        criticality : Integer;
        bp          : Association to BusinessPartners;
}

entity Mitigations : managed {
    key ID       : UUID @(Core.Computed: true);
        descr    : String;
        owner    : String;
        timeline : String;
        risks    : Association to many Risks
                       on risks.miti = $self;
}


entity BusinessPartners {
    key BusinessPartner : String;
        LastName        : String;
        FirstName       : String;
        FullName        : String;
}

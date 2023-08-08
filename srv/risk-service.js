// Imports
const cds = require("@sap/cds");

/**
* The service implementation with all service handlers
*/
module.exports = cds.service.impl(async function () {
    // Define constants for the Risk and BusinessPartners entities from the risk-service.cds file
    const { Risks, BusinessPartners } = this.entities;


    const findCriticallity = (risk) => {
        const criticallityConfig = [
            {
                upto: -Infinity,
                criticallity: 3
            },
            {
                upto: 10000,
                criticallity: 3
            },
            {
                upto: 90000,
                criticallity: 2
            },
            {
                upto: 150000,
                criticallity: 1
            },
            {
                upto: Infinity,
                criticallity: -1
            }]

        criticallityConfig.sort((a, b) => {
            if (a.upto > b.upto) {
                return 1
            }
            if (a.upto < b.upto) {
                return -1
            }
            return 0
        })

        const index = criticallityConfig.findIndex(({ upto }) => {
            return upto > risk.impact
        })

        return criticallityConfig[index - 1].criticallity
    }

    /**
    * Set criticality after a READ operation on /risks
    */
    this.after("READ", Risks, (data) => {
        const risks = Array.isArray(data) ? data : [data];
        risks.forEach((risk) => {
            risk.criticality = findCriticallity(risk)
        });
    });

    const BPsrv = await cds.connect.to("API_BUSINESS_PARTNER");
    /**
    * Event-handler for read-events on the BusinessPartners entity.
    * Each request to the API Business Hub requires the apikey in the header.
    */
    this.on("READ", BusinessPartners, async (req) => {
        // The API Sandbox returns alot of business partners with empty names.
        // We don't want them in our application
        req.query.where("LastName <> '' and FirstName <> '' ");

        return await BPsrv.transaction(req).send({
            query: req.query,
            headers: {
                apikey: process.env.apikey,
            },
        });
    });
});
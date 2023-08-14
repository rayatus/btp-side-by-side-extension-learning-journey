// Imports
const cds = require("@sap/cds");
const req = require("express/lib/request");

/**
* The service implementation with all service handlers
*/
module.exports = cds.service.impl(async function () {
    // Define constants for the Risk and BusinessPartners entities from the risk-service.cds file
    const { Risks, BusinessPartners } = this.entities
    const BPsrv = await cds.connect.to("API_BUSINESS_PARTNER")
    const { A_BusinessPartner } = BPsrv.entities

    const businessPartner_CalculateCustomFields = (bp) => ({
        ...bp,
        FullName: [bp?.FirstName, bp?.LastName].join(" ")
    })

    const findCriticallity = (risk) => {
        
        if (!risk?.impact){
            return undefined
        }

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
        
        return criticallityConfig[index - 1]?.criticallity
    }

    /**
    * Set criticality after a READ operation on /risks
    */
    this.after("READ", Risks, (data) => {
        if (data) {
            const risks = Array.isArray(data) ? data : [data];
            risks.forEach((risk) => {
                risk.criticality = findCriticallity(risk)
            })
        }
    })

    /**
    * Event-handler on risks.
    * Retrieve BusinessPartner data from the external API
    */
    this.on("READ", Risks, async (req, next) => {
        /*
          Check whether the request wants an "expand" of the business partner
          As this is not possible, the risk entity and the business partner entity are in different systems (SAP BTP and S/4 HANA Cloud), 
          if there is such an expand, remove it
        */
        if (!req.query.SELECT.columns) return next();

        const expandIndex = req.query.SELECT.columns.findIndex(
            ({ expand, ref }) => expand && ref[0] === "bp"
        );
        console.log(req.query.SELECT.columns);
        if (expandIndex < 0) return next();

        req.query.SELECT.columns.splice(expandIndex, 1);
        if (
            !req.query.SELECT.columns.find((column) =>
                column.ref.find((ref) => ref == "bp_BusinessPartner")
            )
        ) {
            req.query.SELECT.columns.push({ ref: ["bp_BusinessPartner"] });
        }

        /*
          Instead of carrying out the expand, issue a separate request for each business partner
          This code could be optimized, instead of having n requests for n business partners, just one bulk request could be created
        */
        try {
            res = await next();
            res = Array.isArray(res) ? res : [res];

            await Promise.all(
                res.map(async (risk) => {
                    const bp = await BPsrv.transaction(req).send({
                        query: SELECT.one(A_BusinessPartner.name)
                            .where({ BusinessPartner: risk.bp_BusinessPartner })
                            .columns(["BusinessPartner", "FirstName", "LastName"]),
                        headers: {
                            apikey: process.env.apikey,
                        },
                    });
                    risk.bp = businessPartner_CalculateCustomFields(bp);
                })
            );
        } catch (error) { }
    });

    /**
    * Event Handler which triggers an external API and then calculates a field not exposed by that API
    * at HTTP Header there is APIKEY which is mandatory for consuming SAP API HUB External Services
    * 
    */
    this.on("READ", BusinessPartners, async (req) => {
        
        

        /* 
        req.query.from(A_BusinessPartner.name)          //--> specify which Entity from External service to consume
        req.query.where("LastName <> '' and FirstName <> '' ")
        req.query.columns(["BusinessPartner", "LastName", "FirstName"])
        */

        //Let's build our own specific QUERY so that we do not inherit CAP standard properties within it
        const qry = SELECT.from(A_BusinessPartner.name)
            .where("LastName <> '' and FirstName <> '' ")
            .columns(["BusinessPartner", "LastName", "FirstName"])
            .limit(req.query.SELECT.limit)

        const results = await BPsrv.transaction(qry).send({
            query: qry,
            headers: {
                apikey: process.env.apikey,
            },
        })

        //delete N initial rows for skipping them as API is a service which does not implements $SKIP / $TOP
        if (req.query.SELECT.limit.offset) {
            for (let i = 0; i < req.query.limit.offset; i++) {
                results.shift()
            }
        }

        const data = results.map(bp => businessPartner_CalculateCustomFields(bp));

        if (req.query.SELECT.count) {
            data.$count = data.length
        }

        return data
    })
});
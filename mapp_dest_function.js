const baseURL = new URL("https://columbus.shortest-route.com/pngdev_ecm/api/rest")

// global params
let namespaceId = '' // Persona Space Id
let personaToken = '' // Persona Space Token
let groupId = '' // Group Id in Mapp for subscribing and updating members


/**
 * onTrack takes a Track event and POSTs it to an external API with fetch()
 *
 * @param {SpecTrack} event The track event
 * @param {Object.<string, any>} settings Custom settings
 * @return any
 */
async function onTrack(event, settings) {
    throw new EventNotSupported("track not supported")
  }
  
  
  async function onIdentify(event, settings) {
    let identifier = event.userId
  
    const upsertUser = async (identifier) => {
        let mappUser = await getMappUser(identifier);
        console.log(mappUser)
        let mappUserId = function () {
          //let mappUser = await getMappUser(identifier)
          if (mappUser) {
            console.log("test")
            let mappUserId =  _.get(mappUser , "id").toString();
            console.log(mappUserId)
            return mappUserId
          }
          else if (!mappUser){
            return undefined
          }
        }();
          
          if(mappUser === null ||  mappUser === undefined ){
              
              console.log("creating and subscribing")
              // build profile
              let profile = []
              let attributes = []
              let email
              let emailTrait
              let marketingProgramNumber
              let userTraits = await getUserTraits(event.userId);
              email = userTraits.email
  
              const mapTraitsToProfile = async (object, segmentTrait , mappField) => {
                if (object.hasOwnProperty(segmentTrait)){
                  let trait = {"name" : mappField , "value" : object[segmentTrait] }
                  profile.push(trait)
                }
              }
  
              let buildProfile = function () {
               
                mapTraitsToProfile(userTraits, "email" , "alternateEmail")
                mapTraitsToProfile(event, "userId" , "identifier" )
                mapTraitsToProfile(userTraits , "firstName", "firstName" )
                mapTraitsToProfile(userTraits, "lastName", "lastName" )
                mapTraitsToProfile(userTraits, "registrationDate", "registrationDate" )
                mapTraitsToProfile(userTraits, "birthDate", "birthDate" )
                mapTraitsToProfile(userTraits, "traitLastAnalysisDate", "traitLastAnalysisDate" )
                mapTraitsToProfile(userTraits, "dependent1Birthday", "dependent1Birthday" )
                mapTraitsToProfile(userTraits, "dependent2Birthday", "dependent2Birthday" )
              }();
          
              
              if (userTraits.hasOwnProperty("marketingProgramNumber")) {
                email = event.userId+userTraits.marketingProgramNumber+"@fakedomain.fake"
              }
  
              for (let [key, value] of Object.entries(userTraits)) {
                  if(value){
                      let trait = { "name" : key.substring(0,25) , "value": value }
                      attributes.push(trait)
                  }
              }
              console.log("profile "+ profile)
              // create user in Mapp with profile
              let mappUser = await newUser(email, profile)
              console.log(mappUser)
              let mappUserId =  _.get(mappUser, "id").toString();
              let closeLoop = await pushIdtoSeg(event.userId, mappUserId);
              console.log(mappUserId)
              // subscribe to group
              let subscription = await subscribeUserToGroup(mappUserId);
              // update subscription with attributes
              let updateAttributes = await updateMemberAttributes(mappUserId,attributes);
            }
            else{
              console.log("just subscribing and updating member attributes")
              let attributes = [] 
              let profile = []
              let userTraits = event.traits;
               
              const mapTraitsToProfile = async (object, segmentTrait , mappField) => {
                if (object.hasOwnProperty(segmentTrait)){
                  let trait = {"name" : mappField , "value" : object[segmentTrait] }
                  profile.push(trait)
                }
              }
  
              let buildProfile = function () {
               
                mapTraitsToProfile(userTraits, "email" , "alternateEmail")
                mapTraitsToProfile(event, "userId" , "identifier" )
                mapTraitsToProfile(userTraits , "firstName", "firstName" )
                mapTraitsToProfile(userTraits, "lastName", "lastName" )
               // mapTraitsToProfile(userTraits, "registrationDate", "registrationDate" )
                mapTraitsToProfile(userTraits, "birthDate", "birthDate" )
                mapTraitsToProfile(userTraits, "traitLastAnalysisDate", "traitLastAnalysisDate" )
                mapTraitsToProfile(userTraits, "dependent1Birthday", "dependent1Birthday" )
                mapTraitsToProfile(userTraits, "dependent2Birthday", "dependent2Birthday" )
              }();
  
  
              for (let[key, value] of Object.entries(event.traits)){
                  if(value){
                      let trait = {"name" : key.substring(0,25), "value": value}
                      attributes.push(trait)
                      }
                  }
  
              console.log(JSON.stringify(attributes))
              let subscription = await subscribeUserToGroup(mappUserId)
              let updateProfile = await updateUserProfile(mappUserId, profile)
              let updateAttributes = await updateMemberAttributes(mappUserId,attributes);
            }
              
  
  
          }
  
          const getUserTraits = async (userId) =>{
        let personaUrl = `https://profiles.segment.com/v1/spaces/${namespaceId}/collections/users/profiles/user_id:${userId}/traits?limit=200`
  
        const res = await fetch(personaUrl, {
            headers: new Headers({
                "Authorization": 'Basic ' + btoa(personaToken+":"),
                "Content-Type": "application/json"
            }),
            method: "get",
        })
        let traitsResponse = await res.json()
        
        return traitsResponse.traits
    }
  
      const getMappUser = async (identifier) => {
          const endpoint = `${baseURL}/v4/user/getByIdentifier?identifier=${identifier}`
          const url = new URL(endpoint);
          const res = await fetch(url.toString(), {
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
              "Content-Type": "application/json",
              "Accept": "application/json"
          }),
          method: "get",
          })
          if (res.ok === false){
              return null
          }
          else {
              return res.json()
          }
        
      }
      const newUser = async (mappUserEmailId, profile) => {
          const endpoint = `${baseURL}/v1/user/create?email=${mappUserEmailId}`
          
          const url = new URL(endpoint);
          //const profile =   profile                 
          const res = await fetch(url.toString(), {
              body: JSON.stringify(profile),
              headers: new Headers({
                  "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
                  "Content-Type": "application/json",
                  "Accept": "application/json"
              }),
          method: "post",
          })
          console.log(res.status)
          return await res.json()
      }
  
      const subscribeUserToGroup = async (userId) => {
                  // let user = await newUser();
                  // let userId = _.get(user, "id").toString();
                  console.log(userId)
                  const endpoint = `${baseURL}/v2/membership/subscribe?userId=${userId}&groupId=${groupId}&subscriptionMode=OPT_IN`
          
                  const url = new URL(endpoint);
              
                  const res = await fetch(url.toString(), {
                  headers: new Headers({
                      "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
                      "Content-Type": "application/json",
                      "Accept": "application/json"
                  }),
                  method: "post",
                  })
              
                  console.log(res.status)
                  return userId
              }
      const updateMemberAttributes = async (userId, attributes) => {
          const endpoint = `${baseURL}/v2/membership/updateAttributes?userId=${userId}&groupId=${groupId}`
          const url = new URL(endpoint);
  
          const res = await fetch(url.toString(), {
          body: JSON.stringify(attributes),
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
              "Content-Type": "application/json",
              "Accept": "application/json"
          }),
          method: "post",
          })
  
          console.log("update attributes status " + res.statusText )
          return await res.statusText
  
        };
  
      const updateUserProfile = async (mappUserId, profile) => {
          const endpoint = `${baseURL}/v1/user/updateProfile?userId=${mappUserId}`
          const url = new URL(endpoint);                
          const res = await fetch(url.toString(), {
              body: JSON.stringify(profile),
              headers: new Headers({
                  "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
                  "Content-Type": "application/json",
                  "Accept": "application/json"
              }),
          method: "post",
          })
          console.log(res.statusText)
          return await res.text()
      }
  
      const pushIdtoSeg = async(userId, mappUserId) => {
            console.log(mappUserId)
            const endpoint = "https://api.segment.io/v1/identify"
            const writeKey = writekeyForMappUserId
            const identify = {userId: userId, traits: { mappUserId: mappUserId }  }
            console.log(identify)
            const url = new URL(endpoint);
            
            const res = await fetch(url.toString(), {
            body: JSON.stringify(identify),
            headers: new Headers({
                "Authorization": 'Basic ' + btoa(`${writeKey}:`),
                "Content-Type": "application/json"
            }),
            method: "post",
            })
  
                  
                  return [ res.status , res.statusText]
              }
  
      return upsertUser(identifier);
  }
  
  /**
   * onGroup demonstrates how to handle an invalid event
   *
   * @param {SpecGroup} event The group event
   * @param {Object.<string, any>} settings Custom settings
   * @return any
   */
  async function onGroup(event, settings) {
      throw new EventNotSupported("group not supported")
  }
  
  /**
   * onPage demonstrates how to handle an invalid setting
   *
   * @param {SpecPage} event The page event
   * @param {Object.<string, any>} settings Custom settings
   * @return any
   */
  async function onPage(event, settings) {
    if (!settings.accountId) {
      throw new EventNotSupported("page not supported")
  }
  }
  /**
   * onPage demonstrates how to handle an event that isn't supported
   *
   * @param {SpecAlias} event The alias event
   * @param {Object.<string, any>} settings Custom settings
   * @return any
   */
  async function onAlias(event, settings) {
    let userId = event.userId
    let previousId = event.previousId
  
    const manageDupeUsers = async (userId, previousId) => {
      let userTraits = await getUserTraits(userId)
      let previousMappUser = await getMappUser(previousId)
      let previousMappId = _.get(previousMappUser, "id").toString();
      let mappUser = await getMappUser(userId);
      let mappUserId = _.get(mappUser, "id").toString();
      let unsubscribePreviousMappUser = unsubscribeUserFromGroup(previousMappId);
      let profile = []
      let attributes = []
      // need call to update user profile
  
      const mapTraitsToProfile = async (object, segmentTrait , mappField) => {
            if (object.hasOwnProperty(segmentTrait)){
              let trait = {"name" : mappField , "value" : object[segmentTrait] }
              profile.push(trait)
            }
          }
  
          let buildProfile = function () {
            
            mapTraitsToProfile(userTraits, "email" , "alternateEmail")
            mapTraitsToProfile(event, "userId" , "identifier" )
            mapTraitsToProfile(userTraits , "firstName", "firstName" )
            mapTraitsToProfile(userTraits, "lastName", "lastName" )
            mapTraitsToProfile(userTraits, "registrationDate", "registrationDate" )
            mapTraitsToProfile(userTraits, "birthDate", "birthDate" )
            mapTraitsToProfile(userTraits, "traitLastAnalysisDate", "traitLastAnalysisDate" )
            mapTraitsToProfile(userTraits, "dependent1Birthday", "dependent1Birthday" )
            mapTraitsToProfile(userTraits, "dependent2Birthday", "dependent2Birthday" )
          }();
          
          for (let [key, value] of Object.entries(userTraits)) {
              if(value){
                  let trait = { "name" : key.substring(0,25) , "value": value }
                  attributes.push(trait)
              }
          }
  
  
      // subscribe to group
      let subscription = await subscribeUserToGroup(mappUserId);
      // update profile and subscription with traits
      let updateProfile = await updateUserProfile(mappUserId, profile)
      let updateAttributes = await updateMemberAttributes(mappUserId,attributes);
    }
  
  
    
  
    const getUserTraits = async (userId) =>{
      let personaUrl = `https://profiles.segment.com/v1/spaces/${namespaceId}/collections/users/profiles/user_id:${userId}/traits?limit=200`
      const res = await fetch(personaUrl, {
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(personaToken+":"),
              "Content-Type": "application/json"
          }),
          method: "get",
      })
      let traitsResponse = await res.json()
      return traitsResponse.traits
  }
  
    const getMappUser = async (identifier) => {
      const endpoint = `${baseURL}/v4/user/getByIdentifier?identifier=${identifier}`
        const url = new URL(endpoint);
        const res = await fetch(url.toString(), {
        headers: new Headers({
            "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
            "Content-Type": "application/json",
            "Accept": "application/json"
        }),
        method: "get",
        })
        if (res.ok === false){
            return null
        }
        else {
            return res.json()
        }
  
      }
  
      const unsubscribeUserFromGroup = async (userId) => {
          const endpoint = `${baseURL}/v2/membership/unsubscribe?userId=${userId}&groupId=${groupId}`
          console.log(endpoint)
          const url = new URL(endpoint);
          const res = await fetch(url.toString(), {
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
              "Content-Type": "application/json",
              "Accept": "application/json"
          }),
          method: "post",
          })
      
          console.log(res.statusText)
          return res.status
  
      }
          const updateUserProfile = async (mappUserId, profile) => {
          const endpoint = `${baseURL}/v1/user/updateProfile?userId=${mappUserId}`
          
          const url = new URL(endpoint);                
          const res = await fetch(url.toString(), {
              body: JSON.stringify(profile),
              headers: new Headers({
                  "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
                  "Content-Type": "application/json",
                  "Accept": "application/json"
              }),
          method: "post",
          })
          console.log(res.status)
          return await res.text()
      }
  
      const subscribeUserToGroup = async (userId) => {
        // let user = await newUser();
        // let userId = _.get(user, "id").toString();
        console.log("inside subscribe " + userId)
        const endpoint = `${baseURL}/v2/membership/subscribe?userId=${userId}&groupId=${groupId}&subscriptionMode=OPT_IN`
  
        const url = new URL(endpoint);
    
        const res = await fetch(url.toString(), {
        headers: new Headers({
            "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
            "Content-Type": "application/json",
            "Accept": "application/json"
        }),
        method: "post",
        })
    
        console.log(res.status)
        return userId
    }
      const updateMemberAttributes = async (userId, attributes) => {
        const endpoint = `${baseURL}/v2/membership/updateAttributes?userId=${userId}&groupId=${groupId}`
        const url = new URL(endpoint);
  
        const res = await fetch(url.toString(), {
        body: JSON.stringify(attributes),
        headers: new Headers({
            "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
            "Content-Type": "application/json",
            "Accept": "application/json"
        }),
        method: "post",
        })
  
        console.log( "inside update attributes " + res.status )
        return await res.text();
  
        };
  
        return await manageDupeUsers(userId, previousId); 
  }
  
  /**
   * onScreen demonstrates that not defining a function implies EventNotSupported
   *
   * @param {SpecScreen} event The screen event
   * @param {Object.<string, any>} settings Custom settings
   * @return any
   */
  async function onScreen(event, settings) {
     throw new EventNotSupported("screen not supported")
   }
  
   async function onDelete(event, settings) {
  
      const getMappUser = async () => {
          const endpoint = `${baseURL}/v4/user/getByIdentifier?identifier=${event.userId}`
          const url = new URL(endpoint);
          const res = await fetch(url.toString(), {
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
              "Content-Type": "application/json",
              "Accept": "application/json"
          }),
          method: "get",
          })
          if (res.ok === false){
              return null
          }
          else {
              return res.json()
          }
  
          }
          let mappUser = await getMappUser();
          let mappUserId = _.get(mappUser, "id").toString();
          console.log(mappUserId)
         const deleteMappUser = async () => {
          const endpoint = `${baseURL}/v1/user/delete?userId=${mappUserId}`
          console.log(endpoint)
          const url = new URL(endpoint);
          const res = await fetch(url.toString(), {
          headers: new Headers({
              "Authorization": 'Basic ' + btoa(`rami.hamdan@segment.com:${settings.apiKey}`),
              "Content-Type": "application/json",
              "Accept": "application/json"
          }),
          method: "delete",
          })
          if (res.ok === false){
              return res.statusText
          }
          else {
              return ["user deleted in mapp"]
          }
              
      }
      return await deleteMappUser();
  
   }
  
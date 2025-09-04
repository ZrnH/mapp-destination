const baseURL = new URL("https://columbus.shortest-route.com/pngdev_ecm/api/rest")

/**
 * Configuration helper function to securely access settings
 * @param {Object.<string, any>} settings Custom settings from Segment
 * @returns {Object} Configuration object with all required parameters
 */
function getConfig(settings) {
  if (!settings) {
    throw new Error('Settings object is required')
  }
  
  const requiredSettings = [
    'namespaceId',      // Persona Space Id
    'personaToken',     // Persona Space Token  
    'groupId',          // Group Id in Mapp for subscribing and updating members
    'writekeyForMappUserId', // Write key for pushing Mapp IDs back to Segment
    'apiKey',           // Mapp API Key
    'apiEmail'          // Mapp API Email
  ]
  
  const missingSettings = requiredSettings.filter(setting => !settings[setting])
  if (missingSettings.length > 0) {
    throw new Error(`Missing required settings: ${missingSettings.join(', ')}`)
  }
  
  return {
    namespaceId: settings.namespaceId,
    personaToken: settings.personaToken,
    groupId: settings.groupId,
    writekeyForMappUserId: settings.writekeyForMappUserId,
    apiKey: settings.apiKey,
    apiEmail: settings.apiEmail
  }
}

/**
 * Utility function to create HTTP headers for Mapp API
 * @param {Object} config Configuration object
 * @returns {Headers} Headers object
 */
function createMappHeaders(config) {
  return new Headers({
    "Authorization": `Basic ${btoa(`${config.apiEmail}:${config.apiKey}`)}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  })
}

/**
 * Utility function to create HTTP headers for Segment API
 * @param {string} writeKey Write key for authentication
 * @returns {Headers} Headers object
 */
function createSegmentHeaders(writeKey) {
  return new Headers({
    "Authorization": `Basic ${btoa(`${writeKey}:`)}`,
    "Content-Type": "application/json"
  })
}

/**
 * Utility function to create HTTP headers for Persona API
 * @param {string} personaToken Persona token for authentication
 * @returns {Headers} Headers object
 */
function createPersonaHeaders(personaToken) {
  return new Headers({
    "Authorization": `Basic ${btoa(`${personaToken}:`)}`,
    "Content-Type": "application/json"
  })
}

/**
 * Utility function to map traits to profile format
 * @param {Object} sourceObject Object containing traits
 * @param {string} segmentTrait Segment trait name
 * @param {string} mappField Mapp field name
 * @param {Array} profileArray Array to push the trait to
 */
function mapTraitsToProfile(sourceObject, segmentTrait, mappField, profileArray) {
  if (sourceObject && sourceObject.hasOwnProperty(segmentTrait) && sourceObject[segmentTrait]) {
    const trait = {
      "name": mappField,
      "value": sourceObject[segmentTrait]
    }
    profileArray.push(trait)
  }
}

/**
 * Utility function to build profile from user traits
 * @param {Object} userTraits User traits object
 * @param {Object} event Event object
 * @returns {Array} Profile array
 */
function buildUserProfile(userTraits, event) {
  const profile = []
  
  mapTraitsToProfile(userTraits, "email", "alternateEmail", profile)
  mapTraitsToProfile(event, "userId", "identifier", profile)
  mapTraitsToProfile(userTraits, "firstName", "firstName", profile)
  mapTraitsToProfile(userTraits, "lastName", "lastName", profile)
  mapTraitsToProfile(userTraits, "registrationDate", "registrationDate", profile)
  mapTraitsToProfile(userTraits, "birthDate", "birthDate", profile)
  mapTraitsToProfile(userTraits, "traitLastAnalysisDate", "traitLastAnalysisDate", profile)
  mapTraitsToProfile(userTraits, "dependent1Birthday", "dependent1Birthday", profile)
  mapTraitsToProfile(userTraits, "dependent2Birthday", "dependent2Birthday", profile)
  
  return profile
}

/**
 * Utility function to build attributes from traits
 * @param {Object} traits Traits object
 * @returns {Array} Attributes array
 */
function buildAttributes(traits) {
  const attributes = []
  
  for (const [key, value] of Object.entries(traits)) {
    if (value) {
      const trait = {
        "name": key.substring(0, 25),
        "value": value
      }
      attributes.push(trait)
    }
  }
  
  return attributes
}

/**
 * Utility function to handle API errors
 * @param {Response} response Fetch response object
 * @param {string} operation Operation name for error context
 * @throws {Error} If response is not ok
 */
async function handleApiError(response, operation) {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${operation} failed: ${response.status} ${response.statusText} - ${errorText}`)
  }
}

/**
 * Shared function to get user traits from Persona
 * @param {string} userId User ID
 * @param {Object} config Configuration object
 * @returns {Promise<Object>} User traits
 */
async function getUserTraits(userId, config) {
  const personaUrl = `https://profiles.segment.com/v1/spaces/${config.namespaceId}/collections/users/profiles/user_id:${userId}/traits?limit=200`
  
  const response = await fetch(personaUrl, {
    headers: createPersonaHeaders(config.personaToken),
    method: "GET"
  })
  
  await handleApiError(response, "Get user traits")
  const traitsResponse = await response.json()
  
  return traitsResponse.traits
}

/**
 * Shared function to get Mapp user by identifier
 * @param {string} identifier User identifier
 * @param {Object} config Configuration object
 * @returns {Promise<Object|null>} Mapp user object or null if not found
 */
async function getMappUser(identifier, config) {
  const endpoint = `${baseURL}/v4/user/getByIdentifier?identifier=${identifier}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    headers: createMappHeaders(config),
    method: "GET"
  })
  
  if (!response.ok) {
    return null
  }
  
  return await response.json()
}

/**
 * Shared function to create a new user in Mapp
 * @param {string} email User email
 * @param {Array} profile User profile
 * @param {Object} config Configuration object
 * @returns {Promise<Object>} Created user object
 */
async function createMappUser(email, profile, config) {
  const endpoint = `${baseURL}/v1/user/create?email=${email}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    body: JSON.stringify(profile),
    headers: createMappHeaders(config),
    method: "POST"
  })
  
  await handleApiError(response, "Create Mapp user")
  return await response.json()
}

/**
 * Shared function to subscribe user to group
 * @param {string} userId User ID
 * @param {Object} config Configuration object
 * @returns {Promise<string>} User ID
 */
async function subscribeUserToGroup(userId, config) {
  const endpoint = `${baseURL}/v2/membership/subscribe?userId=${userId}&groupId=${config.groupId}&subscriptionMode=OPT_IN`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    headers: createMappHeaders(config),
    method: "POST"
  })
  
  await handleApiError(response, "Subscribe user to group")
  return userId
}

/**
 * Shared function to unsubscribe user from group
 * @param {string} userId User ID
 * @param {Object} config Configuration object
 * @returns {Promise<number>} Response status
 */
async function unsubscribeUserFromGroup(userId, config) {
  const endpoint = `${baseURL}/v2/membership/unsubscribe?userId=${userId}&groupId=${config.groupId}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    headers: createMappHeaders(config),
    method: "POST"
  })
  
  await handleApiError(response, "Unsubscribe user from group")
  return response.status
}

/**
 * Shared function to update member attributes
 * @param {string} userId User ID
 * @param {Array} attributes Attributes array
 * @param {Object} config Configuration object
 * @returns {Promise<string>} Response text
 */
async function updateMemberAttributes(userId, attributes, config) {
  const endpoint = `${baseURL}/v2/membership/updateAttributes?userId=${userId}&groupId=${config.groupId}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    body: JSON.stringify(attributes),
    headers: createMappHeaders(config),
    method: "POST"
  })
  
  await handleApiError(response, "Update member attributes")
  return await response.text()
}

/**
 * Shared function to update user profile
 * @param {string} userId User ID
 * @param {Array} profile Profile array
 * @param {Object} config Configuration object
 * @returns {Promise<string>} Response text
 */
async function updateUserProfile(userId, profile, config) {
  const endpoint = `${baseURL}/v1/user/updateProfile?userId=${userId}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    body: JSON.stringify(profile),
    headers: createMappHeaders(config),
    method: "POST"
  })
  
  await handleApiError(response, "Update user profile")
  return await response.text()
}

/**
 * Shared function to push Mapp ID back to Segment
 * @param {string} userId User ID
 * @param {string} mappUserId Mapp user ID
 * @param {Object} config Configuration object
 * @returns {Promise<Array>} Response status and text
 */
async function pushIdToSegment(userId, mappUserId, config) {
  const endpoint = "https://api.segment.io/v1/identify"
  const identify = {
    userId: userId,
    traits: { mappUserId: mappUserId }
  }
  
  const url = new URL(endpoint)
  const response = await fetch(url.toString(), {
    body: JSON.stringify(identify),
    headers: createSegmentHeaders(config.writekeyForMappUserId),
    method: "POST"
  })
  
  await handleApiError(response, "Push ID to Segment")
  return [response.status, response.statusText]
}

/**
 * Shared function to delete Mapp user
 * @param {string} userId User ID
 * @param {Object} config Configuration object
 * @returns {Promise<string>} Response text
 */
async function deleteMappUser(userId, config) {
  const endpoint = `${baseURL}/v1/user/delete?userId=${userId}`
  const url = new URL(endpoint)
  
  const response = await fetch(url.toString(), {
    headers: createMappHeaders(config),
    method: "DELETE"
  })
  
  await handleApiError(response, "Delete Mapp user")
  return await response.text()
}


/**
 * onTrack handles track events
 * Currently not supported
 *
 * @param {SpecTrack} event The track event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<never>}
 */
async function onTrack(event, settings) {
  throw new EventNotSupported("track not supported")
}
  
  
  /**
 * onIdentify handles user identification events
 * Creates or updates users in Mapp and manages group subscriptions
 *
 * @param {SpecIdentify} event The identify event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<any>}
 */
async function onIdentify(event, settings) {
  try {
    // Get secure configuration from settings
    const config = getConfig(settings)
    const identifier = event.userId

    // Check if user exists in Mapp
    const mappUser = await getMappUser(identifier, config)
    
    if (!mappUser) {
      // User doesn't exist - create new user
      console.log("Creating new user and subscribing")
      
      // Get user traits from Persona
      const userTraits = await getUserTraits(event.userId, config)
      
      // Build profile and attributes
      const profile = buildUserProfile(userTraits, event)
      const attributes = buildAttributes(userTraits)
      
      // Determine email for Mapp user
      let email = userTraits.email
      if (userTraits.marketingProgramNumber) {
        email = `${event.userId}${userTraits.marketingProgramNumber}@fakedomain.fake`
      }
      
      // Create user in Mapp
      const newMappUser = await createMappUser(email, profile, config)
      const mappUserId = _.get(newMappUser, "id").toString()
      
      // Push Mapp ID back to Segment
      await pushIdToSegment(event.userId, mappUserId, config)
      
      // Subscribe to group and update attributes in parallel
      await Promise.all([
        subscribeUserToGroup(mappUserId, config),
        updateMemberAttributes(mappUserId, attributes, config)
      ])
      
      return { success: true, mappUserId, action: "created" }
    } else {
      // User exists - update existing user
      console.log("Updating existing user")
      
      const mappUserId = _.get(mappUser, "id").toString()
      const userTraits = event.traits || {}
      
      // Build profile and attributes
      const profile = buildUserProfile(userTraits, event)
      const attributes = buildAttributes(userTraits)
      
      // Update user profile, subscribe to group, and update attributes in parallel
      await Promise.all([
        updateUserProfile(mappUserId, profile, config),
        subscribeUserToGroup(mappUserId, config),
        updateMemberAttributes(mappUserId, attributes, config)
      ])
      
      return { success: true, mappUserId, action: "updated" }
    }
  } catch (error) {
    console.error("Error in onIdentify:", error)
    throw error
  }
}
  
/**
 * onGroup handles group events
 * Currently not supported
 *
 * @param {SpecGroup} event The group event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<never>}
 */
async function onGroup(event, settings) {
  throw new EventNotSupported("group not supported")
}

/**
 * onPage handles page events
 * Currently not supported
 *
 * @param {SpecPage} event The page event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<never>}
 */
async function onPage(event, settings) {
  throw new EventNotSupported("page not supported")
}
/**
 * onAlias handles user alias events
 * Manages user merging when a user changes their ID
 *
 * @param {SpecAlias} event The alias event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<any>}
 */
async function onAlias(event, settings) {
  try {
    // Get secure configuration from settings
    const config = getConfig(settings)
    const userId = event.userId
    const previousId = event.previousId

    // Get user traits and Mapp user data
    const [userTraits, previousMappUser, mappUser] = await Promise.all([
      getUserTraits(userId, config),
      getMappUser(previousId, config),
      getMappUser(userId, config)
    ])

    if (!mappUser) {
      throw new Error(`Current user ${userId} not found in Mapp`)
    }

    const mappUserId = _.get(mappUser, "id").toString()
    
    // Unsubscribe previous user if it exists
    if (previousMappUser) {
      const previousMappId = _.get(previousMappUser, "id").toString()
      await unsubscribeUserFromGroup(previousMappId, config)
    }

    // Build profile and attributes
    const profile = buildUserProfile(userTraits, event)
    const attributes = buildAttributes(userTraits)

    // Update user profile, subscribe to group, and update attributes in parallel
    await Promise.all([
      updateUserProfile(mappUserId, profile, config),
      subscribeUserToGroup(mappUserId, config),
      updateMemberAttributes(mappUserId, attributes, config)
    ])

    return { 
      success: true, 
      mappUserId, 
      action: "aliased",
      previousMappUserId: previousMappUser ? _.get(previousMappUser, "id").toString() : null
    }
  } catch (error) {
    console.error("Error in onAlias:", error)
    throw error
  }
}
  
/**
 * onScreen handles screen events
 * Currently not supported
 *
 * @param {SpecScreen} event The screen event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<never>}
 */
async function onScreen(event, settings) {
  throw new EventNotSupported("screen not supported")
}
  
/**
 * onDelete handles user deletion events
 * Removes users from Mapp
 *
 * @param {SpecDelete} event The delete event
 * @param {Object.<string, any>} settings Custom settings
 * @return {Promise<any>}
 */
async function onDelete(event, settings) {
  try {
    // Get secure configuration from settings
    const config = getConfig(settings)

    // Get Mapp user by identifier
    const mappUser = await getMappUser(event.userId, config)
    
    if (!mappUser) {
      console.log(`User ${event.userId} not found in Mapp`)
      return { success: true, message: "User not found in Mapp" }
    }

    const mappUserId = _.get(mappUser, "id").toString()
    
    // Delete user from Mapp
    await deleteMappUser(mappUserId, config)
    
    return { 
      success: true, 
      mappUserId, 
      message: "User deleted from Mapp" 
    }
  } catch (error) {
    console.error("Error in onDelete:", error)
    throw error
  }
}
  
# Mapp Destination for Segment

A Segment destination integration for Mapp (formerly known as BlueHornet), enabling seamless data synchronization between Segment and Mapp's marketing automation platform.

## Overview

This destination allows you to:
- **Identify users** - Create and update user profiles in Mapp
- **Manage subscriptions** - Subscribe/unsubscribe users to/from Mapp groups
- **Handle user aliases** - Merge user profiles when IDs change
- **Delete users** - Remove users from Mapp when they're deleted in Segment
- **Sync user traits** - Keep user attributes synchronized between platforms

## Supported Events

| Event Type | Support | Description |
|------------|---------|-------------|
| `identify` | ✅ Full | Creates/updates users and manages group subscriptions |
| `alias` | ✅ Full | Handles user ID changes and profile merging |
| `delete` | ✅ Full | Removes users from Mapp |
| `track` | ❌ Not Supported | Track events are not supported |
| `group` | ❌ Not Supported | Group events are not supported |
| `page` | ❌ Not Supported | Page events are not supported |
| `screen` | ❌ Not Supported | Screen events are not supported |

## Configuration

### Required Settings

Configure the following settings in your Segment destination:

| Setting | Description | Required |
|---------|-------------|----------|
| `namespaceId` | Persona Space ID for accessing user traits | ✅ |
| `personaToken` | Persona Space Token for authentication | ✅ |
| `groupId` | Mapp Group ID for subscribing and updating members | ✅ |
| `writekeyForMappUserId` | Segment write key for pushing Mapp IDs back to Segment | ✅ |
| `apiKey` | Mapp API Key for authentication | ✅ |
| `apiEmail` | Mapp API Email for authentication | ✅ |

### API Endpoints

The destination uses the following Mapp API endpoints:
- **Base URL**: `https://columbus.shortest-route.com/pngdev_ecm/api/rest`
- **User Management**: `/v1/user/*`
- **Membership Management**: `/v2/membership/*`
- **User Operations**: `/v4/user/*`

## How It Works

### User Identification Flow

1. **Check Existing User**: Queries Mapp to see if user already exists
2. **Create New User** (if not found):
   - Fetches user traits from Segment Persona
   - Creates user profile in Mapp
   - Subscribes user to configured group
   - Updates member attributes
   - Pushes Mapp user ID back to Segment
3. **Update Existing User** (if found):
   - Updates user profile in Mapp
   - Ensures group subscription
   - Updates member attributes

### User Alias Flow

1. **Fetch User Data**: Gets traits and both current/previous user records
2. **Unsubscribe Previous**: Removes previous user from group
3. **Update Current**: Updates current user profile and attributes
4. **Maintain Subscription**: Ensures current user remains subscribed

### User Deletion Flow

1. **Find User**: Locates user in Mapp by identifier
2. **Delete User**: Removes user from Mapp system
3. **Return Status**: Confirms deletion or reports if user not found

## User Profile Mapping

The destination maps the following Segment traits to Mapp profile fields:

| Segment Trait | Mapp Field | Description |
|---------------|------------|-------------|
| `email` | `alternateEmail` | User's email address |
| `userId` | `identifier` | Unique user identifier |
| `firstName` | `firstName` | User's first name |
| `lastName` | `lastName` | User's last name |
| `registrationDate` | `registrationDate` | User registration date |
| `birthDate` | `birthDate` | User's birth date |
| `traitLastAnalysisDate` | `traitLastAnalysisDate` | Last analysis date |
| `dependent1Birthday` | `dependent1Birthday` | First dependent's birthday |
| `dependent2Birthday` | `dependent2Birthday` | Second dependent's birthday |

### Dynamic Attributes

All other user traits are automatically mapped as dynamic attributes with the following rules:
- Trait names are truncated to 25 characters (Mapp limitation)
- Only non-null/non-empty values are included
- Attributes are updated on every identify/alias event

## Special Email Handling

For users with a `marketingProgramNumber` trait, the destination creates a special email format:
```
{userId}{marketingProgramNumber}@fakedomain.fake
```

This ensures unique email addresses for program-specific users while maintaining the user ID as the primary identifier.

## Error Handling

The destination includes comprehensive error handling:
- **Configuration Validation**: Ensures all required settings are present
- **API Error Handling**: Provides detailed error messages for failed API calls
- **User Not Found**: Gracefully handles cases where users don't exist
- **Network Errors**: Proper error propagation for debugging

## API Rate Limits

Be aware of Mapp's API rate limits when configuring your Segment destination. Consider:
- Batch processing for high-volume events
- Monitoring API response times
- Implementing retry logic if needed

## Dependencies

This destination requires:
- **Segment Persona**: For accessing user traits
- **Mapp API Access**: Valid API credentials
- **Network Access**: HTTPS connectivity to Mapp and Segment APIs

## Security Considerations

- All API communications use HTTPS
- Authentication uses Basic Auth with base64 encoding
- Sensitive configuration is handled through Segment's secure settings
- No sensitive data is logged in plain text

## Troubleshooting

### Common Issues

1. **"Missing required settings" Error**
   - Ensure all required configuration settings are provided
   - Check that setting names match exactly (case-sensitive)

2. **"User not found in Mapp" Error**
   - Verify the user exists in your Mapp system
   - Check that the identifier format matches expectations

3. **API Authentication Errors**
   - Verify your Mapp API credentials are correct
   - Ensure your API key has the necessary permissions

4. **Group Subscription Failures**
   - Confirm the group ID exists in Mapp
   - Verify your API key has group management permissions

### Debugging

Enable detailed logging by checking the browser console or your Segment function logs for:
- API request/response details
- User creation/update operations
- Error messages with context

## Support

For issues related to:
- **Mapp API**: Contact Mapp support
- **Segment Integration**: Check Segment's documentation
- **This Destination**: Review the code and error logs

## Version History

- **v1.0.0**: Initial implementation with identify, alias, and delete support

## License

This destination is provided as-is for integration with Segment and Mapp platforms.

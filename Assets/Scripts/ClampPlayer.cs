using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ClampPlayer : MonoBehaviour
{
    public SpriteRenderer wallSpriteR;
    Vector2 screenBounds;
    SpriteRenderer playerSpriteR;
    float playerWidth, playerHeight, wallWidth;

    void Start()
    {
        playerSpriteR = GetComponent<SpriteRenderer>();
        wallWidth = wallSpriteR.bounds.extents.x;

        screenBounds = Camera.main.ScreenToWorldPoint(new Vector3(Screen.width, Screen.height, Camera.main.transform.position.z));   
    }

    void LateUpdate()
    {
        playerWidth = playerSpriteR.bounds.extents.x;
        playerHeight = playerSpriteR.bounds.extents.y;
        
        Vector3 viewPos = transform.position;
        viewPos.x = Mathf.Clamp(viewPos.x, -screenBounds.x + playerWidth + wallWidth, screenBounds.x - playerWidth - wallWidth);
        viewPos.y = Mathf.Clamp(viewPos.y, -screenBounds.y + playerHeight + wallWidth, screenBounds.y - playerHeight - wallWidth);
        
        transform.position = viewPos;
    }
}